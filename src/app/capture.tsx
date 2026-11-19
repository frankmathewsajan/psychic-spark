import {
	type BarcodeScanningResult,
	CameraView,
	useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import { Accelerometer } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "@/components/app-symbol";
import { MD3 } from "@/constants/theme";
import { getCachedCoordinates, getCurrentCoordinates } from "@/core/location";
import { logger } from "@/core/logger";
import { calculateWallTilt } from "@/services/sensor/leveling";

export default function CaptureScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { width: screenW, height: screenH } = useWindowDimensions();
	const cameraRef = useRef<CameraView>(null);

	const displayBoundsRef = useRef<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null>(null);
	const reticleAreaLayoutRef = useRef<{
		x: number;
		y: number;
		width: number;
		height: number;
	}>({ x: 0, y: 0, width: 0, height: 0 });
	const casingLayoutRef = useRef<{
		x: number;
		y: number;
		width: number;
		height: number;
	}>({ x: 0, y: 0, width: 0, height: 0 });
	const displayLayoutRef = useRef<{
		x: number;
		y: number;
		width: number;
		height: number;
	}>({ x: 0, y: 0, width: 0, height: 0 });

	const updateDisplayBounds = () => {
		if (
			displayLayoutRef.current.width > 0 &&
			casingLayoutRef.current.width > 0 &&
			reticleAreaLayoutRef.current.width > 0
		) {
			const absX =
				reticleAreaLayoutRef.current.x +
				casingLayoutRef.current.x +
				displayLayoutRef.current.x;
			const absY =
				reticleAreaLayoutRef.current.y +
				casingLayoutRef.current.y +
				displayLayoutRef.current.y;
			const absW = displayLayoutRef.current.width;
			const absH = displayLayoutRef.current.height;
			displayBoundsRef.current = {
				x: absX,
				y: absY,
				width: absW,
				height: absH,
			};
		}
	};

	const [permission, requestPermission] = useCameraPermissions();

	const [torchActive, setTorchActive] = useState(false);
	const [zoom, setZoom] = useState(0);
	const [tilt, setTilt] = useState(0);
	const [isAligned, setIsAligned] = useState(false);
	const [isCapturing, setIsCapturing] = useState(false);
	const [isCameraReady, setIsCameraReady] = useState(false);
	const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
	const detectedBarcodeRef = useRef<string | null>(null);

	useEffect(() => {
		getCurrentCoordinates();
		Accelerometer.setUpdateInterval(100);
		const subscription = Accelerometer.addListener(({ x, y, z }) => {
			const evaluation = calculateWallTilt(x, y, z);
			setTilt(evaluation.tiltFromVertical);
			setIsAligned(evaluation.isAligned);
		});
		return () => subscription.remove();
	}, []);

	if (!permission) {
		return (
			<View style={styles.centerBox}>
				<StatusBar style="dark" />
				<ActivityIndicator size="small" color={MD3.color.primary} />
			</View>
		);
	}

	if (!permission.granted) {
		return (
			<View style={styles.permissionBox}>
				<StatusBar style="dark" />
				<Text style={styles.permTitle}>Camera Permission Required</Text>
				<Pressable style={styles.permBtn} onPress={requestPermission}>
					<Text style={styles.permBtnText}>Grant Access</Text>
				</Pressable>
			</View>
		);
	}

	const handleCapture = async () => {
		if (!cameraRef.current || isCapturing || !isCameraReady) return;

		try {
			setIsCapturing(true);
			// skipProcessing: true returns in < 250ms with zero UI freeze
			const photo = await cameraRef.current.takePictureAsync({
				quality: 0.85,
				skipProcessing: true,
			});

			if (photo?.uri) {
				setTorchActive(false);
				const snapTilt = tilt;
				const snapBarcode = detectedBarcodeRef.current;

				let cropBoundsJson: string | null = null;
				if (screenW > 0 && screenH > 0) {
					const isPortrait = screenH >= screenW;
					const rawPhotoW = photo.width || screenW;
					const rawPhotoH = photo.height || screenH;

					// Normalize photo dimensions to match screen orientation
					const sensorW = isPortrait
						? Math.min(rawPhotoW, rawPhotoH)
						: Math.max(rawPhotoW, rawPhotoH);
					const sensorH = isPortrait
						? Math.max(rawPhotoW, rawPhotoH)
						: Math.min(rawPhotoW, rawPhotoH);

					const scale = Math.max(screenW / sensorW, screenH / sensorH);
					const renderedW = sensorW * scale;
					const renderedH = sensorH * scale;
					const offsetX = (renderedW - screenW) / 2;
					const offsetY = (renderedH - screenH) / 2;

					const box = displayBoundsRef.current || {
						x: screenW * 0.18,
						y: screenH * 0.28,
						width: screenW * 0.64,
						height: screenH * 0.22,
					};

					const cropX = Math.max(0, (box.x + offsetX) / scale);
					const cropY = Math.max(0, (box.y + offsetY) / scale);
					const cropW = Math.min(sensorW - cropX, box.width / scale);
					const cropH = Math.min(sensorH - cropY, box.height / scale);

					const normX = Math.max(0, Math.min(0.95, cropX / sensorW));
					const normY = Math.max(0, Math.min(0.95, cropY / sensorH));
					let normW = Math.max(0.05, Math.min(1.0 - normX, cropW / sensorW));
					let normH = Math.max(0.05, Math.min(1.0 - normY, cropH / sensorH));

					// Clamping safeguards: normX + normW <= 1, normY + normH <= 1
					if (normX + normW > 1.0) normW = Math.max(0.05, 1.0 - normX);
					if (normY + normH > 1.0) normH = Math.max(0.05, 1.0 - normY);

					cropBoundsJson = JSON.stringify([normX, normY, normW, normH]);
				}

				const coords =
					getCachedCoordinates() || (await getCurrentCoordinates());

				// Do NOT insert into SQLite or wake useBackgroundMlWorker here.
				// Immediately push to /inspect-preview for zero-delay UX.
				router.push({
					pathname: "/inspect-preview",
					params: {
						photoUri: photo.uri,
						photoWidth: String(photo.width || screenW),
						photoHeight: String(photo.height || screenH),
						tilt: String(snapTilt),
						barcode: snapBarcode || "",
						cropBoundsJson: cropBoundsJson || "",
						latitude: String(coords.latitude),
						longitude: String(coords.longitude),
					},
				});
			}
		} catch (error) {
			logger.warn("Capture", "Capture failed", error);
		} finally {
			setIsCapturing(false);
		}
	};

	return (
		<View style={styles.container}>
			<StatusBar style="light" />
			<CameraView
				ref={cameraRef}
				style={StyleSheet.absoluteFill}
				facing="back"
				zoom={zoom}
				enableTorch={torchActive}
				onCameraReady={() => setIsCameraReady(true)}
				barcodeScannerSettings={{
					barcodeTypes: ["qr", "code128", "code39", "ean13"],
				}}
				onBarcodeScanned={(result: BarcodeScanningResult) => {
					if (result.data && result.data !== detectedBarcodeRef.current) {
						detectedBarcodeRef.current = result.data;
						setDetectedBarcode(result.data);
					}
				}}
			/>

			{/* TOP APP BAR */}
			<View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
				<Pressable style={styles.iconBtn} onPress={() => router.back()}>
					<AppSymbol name="back" size={20} color="#FFFFFF" />
				</Pressable>

				<View
					style={[styles.tiltPill, isAligned ? styles.tiltOk : styles.tiltWarn]}
				>
					<Text style={styles.tiltText}>
						{tilt}° {isAligned ? "Level" : "Tilt"}
					</Text>
				</View>

				<Pressable
					style={[styles.iconBtn, torchActive && styles.iconBtnActive]}
					onPress={() => setTorchActive(!torchActive)}
				>
					<AppSymbol
						name={torchActive ? "flash-on" : "flash-off"}
						size={18}
						color={torchActive ? "#000000" : "#FFFFFF"}
					/>
				</Pressable>
			</View>

			{/* BARCODE PILL */}
			{detectedBarcode && (
				<View style={styles.barcodePill}>
					<AppSymbol name="barcode" size={14} color="#FFFFFF" />
					<Text style={styles.barcodeText}>{detectedBarcode}</Text>
				</View>
			)}

			{/* RETICLE OVERLAY (Pure relative onLayout geometry) */}
			<View
				style={styles.reticleArea}
				onLayout={(e) => {
					reticleAreaLayoutRef.current = e.nativeEvent.layout;
					updateDisplayBounds();
				}}
			>
				<View
					style={styles.casingBox}
					onLayout={(e) => {
						casingLayoutRef.current = e.nativeEvent.layout;
						updateDisplayBounds();
					}}
				>
					<View
						style={styles.displayBox}
						onLayout={(e) => {
							displayLayoutRef.current = e.nativeEvent.layout;
							updateDisplayBounds();
						}}
					/>
				</View>
			</View>

			{/* BOTTOM CAPTURE BAR */}
			<View
				style={[
					styles.bottomBar,
					{ paddingBottom: Math.max(insets.bottom, 16) },
				]}
			>
				{/* ZOOM PRESET SELECTOR */}
				<View style={styles.zoomRow}>
					{[
						{ label: "1x", val: 0 },
						{ label: "1.5x", val: 0.15 },
						{ label: "2x", val: 0.3 },
					].map((z) => (
						<Pressable
							key={z.label}
							style={[styles.zoomPill, zoom === z.val && styles.zoomPillActive]}
							onPress={() => setZoom(z.val)}
						>
							<Text
								style={[
									styles.zoomText,
									zoom === z.val && styles.zoomTextActive,
								]}
							>
								{z.label}
							</Text>
						</Pressable>
					))}
				</View>

				<View style={styles.controlsRow}>
					<Pressable
						style={styles.subBtn}
						onPress={() =>
							router.push({
								pathname: "/validation",
								params: {
									sn: detectedBarcodeRef.current || "",
									kwh: "",
									confidence: "0.000",
									status: "WARNING",
									source: "manual",
								},
							})
						}
					>
						<Text style={styles.subBtnText}>Manual</Text>
					</Pressable>

					<Pressable
						disabled={isCapturing || !isCameraReady}
						style={[
							styles.shutterBtn,
							(isCapturing || !isCameraReady) && styles.shutterDisabled,
						]}
						onPress={handleCapture}
					>
						{isCapturing ? (
							<ActivityIndicator size="small" color="#FFFFFF" />
						) : (
							<View style={styles.shutterInner} />
						)}
					</Pressable>

					<Pressable style={styles.subBtn} onPress={() => router.back()}>
						<Text style={styles.subBtnText}>Close</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#000000" },
	centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },
	permissionBox: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: 16,
	},
	permTitle: { fontSize: 16, fontWeight: "600", color: MD3.color.onSurface },
	permBtn: {
		backgroundColor: MD3.color.primary,
		paddingVertical: 10,
		paddingHorizontal: 20,
		borderRadius: MD3.shape.cornerFull,
	},
	permBtnText: { color: "#FFFFFF", fontWeight: "600" },

	topBar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		zIndex: 10,
	},
	iconBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(0,0,0,0.45)",
		justifyContent: "center",
		alignItems: "center",
	},
	iconBtnActive: {
		backgroundColor: "#FFFFFF",
	},
	tiltPill: {
		paddingVertical: 6,
		paddingHorizontal: 14,
		borderRadius: MD3.shape.cornerFull,
		backgroundColor: "rgba(0,0,0,0.5)",
		borderWidth: 1,
	},
	tiltOk: { borderColor: MD3.color.success },
	tiltWarn: { borderColor: MD3.color.warn },
	tiltText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },

	barcodePill: {
		position: "absolute",
		top: 140,
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "rgba(0,0,0,0.6)",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: MD3.shape.cornerFull,
		zIndex: 15,
	},
	barcodeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },

	reticleArea: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
	},
	casingBox: {
		width: "88%",
		height: "72%",
		borderWidth: 1.5,
		borderColor: "rgba(255,255,255,0.4)",
		borderRadius: 16,
		borderStyle: "dashed",
		paddingTop: "19%",
		alignItems: "center",
	},
	displayBox: {
		width: "74%",
		height: "22%",
		borderWidth: 1.5,
		borderColor: "#60A5FA",
		borderRadius: 8,
		backgroundColor: "rgba(96, 165, 250, 0.1)",
	},

	bottomBar: {
		paddingHorizontal: 24,
		paddingTop: 16,
	},
	zoomRow: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	zoomPill: {
		paddingVertical: 4,
		paddingHorizontal: 12,
		borderRadius: MD3.shape.cornerFull,
		backgroundColor: "rgba(0,0,0,0.5)",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.3)",
	},
	zoomPillActive: {
		backgroundColor: "#FFFFFF",
		borderColor: "#FFFFFF",
	},
	zoomText: {
		color: "rgba(255,255,255,0.8)",
		fontSize: 12,
		fontWeight: "600",
	},
	zoomTextActive: {
		color: "#000000",
	},
	controlsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	shutterBtn: {
		width: 72,
		height: 72,
		borderRadius: 36,
		borderWidth: 4,
		borderColor: "#FFFFFF",
		justifyContent: "center",
		alignItems: "center",
	},
	shutterInner: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#FFFFFF",
	},
	shutterDisabled: { opacity: 0.4 },

	subBtn: {
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: MD3.shape.cornerFull,
		backgroundColor: "rgba(255,255,255,0.2)",
	},
	subBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
