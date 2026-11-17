import {
	type BarcodeScanningResult,
	CameraView,
	useCameraPermissions,
} from "expo-camera";
import { Directory, File, Paths } from "expo-file-system";
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
import { getDb } from "@/core/db/client";
import { insertInspection } from "@/core/db/repository";
import { logger } from "@/core/logger";
import { subscribeUnreadableCapture } from "@/services/inference/background-ml-worker";
import { calculateWallTilt } from "@/services/sensor/leveling";

export default function CaptureScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { width: screenW, height: screenH } = useWindowDimensions();
	const cameraRef = useRef<CameraView>(null);
	const displayRef = useRef<React.ComponentRef<typeof View>>(null);
	const displayBoundsRef = useRef<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null>(null);
	const [permission, requestPermission] = useCameraPermissions();

	const [torchActive, setTorchActive] = useState(false);
	const [zoom, setZoom] = useState(0);
	const [tilt, setTilt] = useState(0);
	const [isAligned, setIsAligned] = useState(false);
	const [isCapturing, setIsCapturing] = useState(false);
	const [isCameraReady, setIsCameraReady] = useState(false);
	const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
	const detectedBarcodeRef = useRef<string | null>(null);

	const [queuedCount, setQueuedCount] = useState(0);
	const [toast, setToast] = useState<string | null>(null);
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		Accelerometer.setUpdateInterval(100);
		const subscription = Accelerometer.addListener(({ x, y, z }) => {
			const evaluation = calculateWallTilt(x, y, z);
			setTilt(evaluation.tiltFromVertical);
			setIsAligned(evaluation.isAligned);
		});
		return () => subscription.remove();
	}, []);

	useEffect(() => {
		const unsubscribe = subscribeUnreadableCapture((_id, reason) => {
			setToast(`Unreadable photo: ${reason}`);
			if (toastTimer.current) clearTimeout(toastTimer.current);
			toastTimer.current = setTimeout(() => setToast(null), 4000);
		});
		return () => {
			unsubscribe();
			if (toastTimer.current) clearTimeout(toastTimer.current);
		};
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
			const photo = await cameraRef.current.takePictureAsync({
				quality: 0.85,
			});

			if (photo?.uri) {
				setTorchActive(false);
				const id = `insp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
				const snapTilt = tilt;
				const snapBarcode = detectedBarcodeRef.current;

				let persistentPath = photo.uri;
				try {
					const capturesDir = new Directory(Paths.document, "captures");
					if (!capturesDir.exists) capturesDir.create();
					const destFile = new File(capturesDir, `${id}.jpg`);
					const sourceFile = new File(photo.uri);
					await sourceFile.copy(destFile);
					persistentPath = destFile.uri;
				} catch {}

				let cropBoundsJson: string | null = null;
				if (displayBoundsRef.current && screenW > 0 && screenH > 0) {
					const photoW = photo.width || screenW;
					const photoH = photo.height || screenH;
					const isPortrait = screenH >= screenW;
					const sensorW = isPortrait
						? Math.min(photoW, photoH)
						: Math.max(photoW, photoH);
					const sensorH = isPortrait
						? Math.max(photoW, photoH)
						: Math.min(photoW, photoH);

					const scale = Math.max(screenW / sensorW, screenH / sensorH);
					const renderedW = sensorW * scale;
					const renderedH = sensorH * scale;
					const offsetX = (renderedW - screenW) / 2;
					const offsetY = (renderedH - screenH) / 2;

					const box = displayBoundsRef.current;
					const cropX = Math.max(0, (box.x + offsetX) / scale);
					const cropY = Math.max(0, (box.y + offsetY) / scale);
					const cropW = Math.min(sensorW - cropX, box.width / scale);
					const cropH = Math.min(sensorH - cropY, box.height / scale);

					const normX = Math.max(0, Math.min(0.95, cropX / sensorW));
					const normY = Math.max(0, Math.min(0.95, cropY / sensorH));
					const normW = Math.max(0.05, Math.min(1 - normX, cropW / sensorW));
					const normH = Math.max(0.05, Math.min(1 - normY, cropH / sensorH));
					cropBoundsJson = JSON.stringify([normX, normY, normW, normH]);
				}

				const db = await getDb();
				await insertInspection(db, {
					id,
					technician_id: "field_tech",
					device_id: "device_01",
					meter_serial_number: snapBarcode || "",
					latitude: 0,
					longitude: 0,
					timestamp_utc: new Date().toISOString(),
					qa_status: "WARNING",
					hazard_reason: null,
					extracted_kwh: null,
					ocr_confidence: null,
					image_local_path: persistentPath,
					inference_status: "PENDING_ML",
					sync_tier1_status: "HOLD_ML",
					tilt_deg: snapTilt,
					crop_bounds_json: cropBoundsJson,
				});

				setDetectedBarcode(null);
				detectedBarcodeRef.current = null;
				setQueuedCount((c) => {
					const next = c + 1;
					setToast(`Queued ✓ (${next})`);
					if (toastTimer.current) clearTimeout(toastTimer.current);
					toastTimer.current = setTimeout(() => setToast(null), 2000);
					return next;
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

			{/* TOAST NOTIFICATION */}
			{toast && (
				<View style={styles.toast}>
					<Text style={styles.toastText}>{toast}</Text>
				</View>
			)}

			{/* BARCODE PILL */}
			{detectedBarcode && (
				<View style={styles.barcodePill}>
					<AppSymbol name="barcode" size={14} color="#FFFFFF" />
					<Text style={styles.barcodeText}>{detectedBarcode}</Text>
				</View>
			)}

			{/* RETICLE OVERLAY */}
			<View style={styles.reticleArea}>
				<View style={styles.casingBox}>
					<View
						ref={displayRef}
						style={styles.displayBox}
						onLayout={() => {
							displayRef.current?.measureInWindow(
								(x: number, y: number, width: number, height: number) => {
									displayBoundsRef.current = { x, y, width, height };
								},
							);
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

					{queuedCount > 0 ? (
						<Pressable style={styles.doneBtn} onPress={() => router.back()}>
							<Text style={styles.doneBtnText}>Done ({queuedCount})</Text>
						</Pressable>
					) : (
						<Pressable style={styles.subBtn} onPress={() => router.back()}>
							<Text style={styles.subBtnText}>Close</Text>
						</Pressable>
					)}
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

	toast: {
		position: "absolute",
		top: 100,
		alignSelf: "center",
		backgroundColor: "rgba(20,20,20,0.9)",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: MD3.shape.cornerFull,
		zIndex: 20,
	},
	toastText: { color: "#FFFFFF", fontSize: 12, fontWeight: "500" },

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
		height: "33%",
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
	doneBtn: {
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: MD3.shape.cornerFull,
		backgroundColor: MD3.color.primary,
	},
	doneBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
	subBtnPlaceholder: { width: 60 },
});
