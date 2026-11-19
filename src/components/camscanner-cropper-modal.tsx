import { Image } from "expo-image";
import { manipulateAsync } from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	PanResponder,
	Pressable,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { AppSymbol } from "@/components/app-symbol";
import { Fonts } from "@/constants/theme";

export interface CamScannerCropperModalProps {
	visible: boolean;
	imageUri: string;
	initialBounds?: [number, number, number, number] | null;
	onClose: () => void;
	onConfirmCrop: (bounds: [number, number, number, number]) => void;
}

type DragTarget = "TL" | "TR" | "BL" | "BR" | "CENTER" | null;

const HANDLE_SIZE = 28;
const MIN_BOX_SIZE = 40;

export function CamScannerCropperModal({
	visible,
	imageUri,
	initialBounds,
	onClose,
	onConfirmCrop,
}: CamScannerCropperModalProps) {
	const [imageDims, setImageDims] = useState<{
		w: number;
		h: number;
	} | null>(null);
	const [layoutDims, setLayoutDims] = useState<{
		w: number;
		h: number;
	} | null>(null);

	// Normalized bounds [normX, normY, normW, normH] in range 0..1
	const [normBounds, setNormBounds] = useState<
		[number, number, number, number]
	>(
		initialBounds && initialBounds.length === 4
			? [
					Math.max(0, Math.min(0.9, initialBounds[0])),
					Math.max(0, Math.min(0.9, initialBounds[1])),
					Math.max(0.05, Math.min(1 - initialBounds[0], initialBounds[2])),
					Math.max(0.05, Math.min(1 - initialBounds[1], initialBounds[3])),
				]
			: [0.18, 0.28, 0.64, 0.22],
	);

	const [activeTarget, setActiveTarget] = useState<DragTarget>(null);

	// Ref to hold mutable state during gesture drags without re-binding panResponder
	const dragRef = useRef({
		normBounds: [0.18, 0.28, 0.64, 0.22] as [number, number, number, number],
		activeTarget: null as DragTarget,
		startX: 0,
		startY: 0,
		startBounds: [0.18, 0.28, 0.64, 0.22] as [number, number, number, number],
		dispX: 0,
		dispY: 0,
		dispW: 1,
		dispH: 1,
	});

	// Load image dimensions via manipulateAsync probe
	useEffect(() => {
		if (!imageUri || !visible) return;
		manipulateAsync(imageUri, [])
			.then((probe) => setImageDims({ w: probe.width, h: probe.height }))
			.catch(() => setImageDims({ w: 1080, h: 1920 }));
	}, [imageUri, visible]);

	// Initialize bounds when modal becomes visible or initialBounds changes
	useEffect(() => {
		if (visible) {
			const b: [number, number, number, number] =
				initialBounds && initialBounds.length === 4
					? [
							Math.max(0, Math.min(0.9, initialBounds[0])),
							Math.max(0, Math.min(0.9, initialBounds[1])),
							Math.max(0.05, Math.min(1 - initialBounds[0], initialBounds[2])),
							Math.max(0.05, Math.min(1 - initialBounds[1], initialBounds[3])),
						]
					: [0.18, 0.28, 0.64, 0.22];
			setNormBounds(b);
			dragRef.current.normBounds = b;
		}
	}, [visible, initialBounds]);

	// Update ref
	useEffect(() => {
		dragRef.current.normBounds = normBounds;
	}, [normBounds]);

	// Compute displayed geometry
	const getGeometry = () => {
		if (!imageDims || !layoutDims || layoutDims.w === 0 || layoutDims.h === 0) {
			return { dispX: 0, dispY: 0, dispW: 1, dispH: 1, scale: 1 };
		}
		const scale = Math.min(
			layoutDims.w / imageDims.w,
			layoutDims.h / imageDims.h,
		);
		const dispW = imageDims.w * scale;
		const dispH = imageDims.h * scale;
		const dispX = (layoutDims.w - dispW) / 2;
		const dispY = (layoutDims.h - dispH) / 2;
		return { dispX, dispY, dispW, dispH, scale };
	};

	const { dispX, dispY, dispW, dispH } = getGeometry();
	dragRef.current.dispX = dispX;
	dragRef.current.dispY = dispY;
	dragRef.current.dispW = dispW;
	dragRef.current.dispH = dispH;

	// Absolute screen coords of active crop box
	const boxLeft = dispX + normBounds[0] * dispW;
	const boxTop = dispY + normBounds[1] * dispH;
	const boxWidth = normBounds[2] * dispW;
	const boxHeight = normBounds[3] * dispH;

	// PanResponder for corner handles and center drag
	const createCornerResponder = (target: DragTarget) => {
		return PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: (evt) => {
				setActiveTarget(target);
				dragRef.current.activeTarget = target;
				dragRef.current.startX = evt.nativeEvent.pageX;
				dragRef.current.startY = evt.nativeEvent.pageY;
				dragRef.current.startBounds = [...dragRef.current.normBounds];
			},
			onPanResponderMove: (evt) => {
				const dx = evt.nativeEvent.pageX - dragRef.current.startX;
				const dy = evt.nativeEvent.pageY - dragRef.current.startY;
				const curDispW = dragRef.current.dispW;
				const curDispH = dragRef.current.dispH;
				if (curDispW <= 0 || curDispH <= 0) return;

				const normDx = dx / curDispW;
				const normDy = dy / curDispH;
				const [sX, sY, sW, sH] = dragRef.current.startBounds;

				let nX = sX;
				let nY = sY;
				let nW = sW;
				let nH = sH;

				const minNormW = MIN_BOX_SIZE / curDispW;
				const minNormH = MIN_BOX_SIZE / curDispH;

				if (target === "TL") {
					const candidateX = Math.max(
						0,
						Math.min(sX + sW - minNormW, sX + normDx),
					);
					const candidateY = Math.max(
						0,
						Math.min(sY + sH - minNormH, sY + normDy),
					);
					nX = candidateX;
					nY = candidateY;
					nW = sX + sW - candidateX;
					nH = sY + sH - candidateY;
				} else if (target === "TR") {
					const candidateR = Math.max(
						sX + minNormW,
						Math.min(1.0, sX + sW + normDx),
					);
					const candidateY = Math.max(
						0,
						Math.min(sY + sH - minNormH, sY + normDy),
					);
					nX = sX;
					nY = candidateY;
					nW = candidateR - sX;
					nH = sY + sH - candidateY;
				} else if (target === "BL") {
					const candidateX = Math.max(
						0,
						Math.min(sX + sW - minNormW, sX + normDx),
					);
					const candidateB = Math.max(
						sY + minNormH,
						Math.min(1.0, sY + sH + normDy),
					);
					nX = candidateX;
					nY = sY;
					nW = sX + sW - candidateX;
					nH = candidateB - sY;
				} else if (target === "BR") {
					const candidateR = Math.max(
						sX + minNormW,
						Math.min(1.0, sX + sW + normDx),
					);
					const candidateB = Math.max(
						sY + minNormH,
						Math.min(1.0, sY + sH + normDy),
					);
					nX = sX;
					nY = sY;
					nW = candidateR - sX;
					nH = candidateB - sY;
				} else if (target === "CENTER") {
					nX = Math.max(0, Math.min(1.0 - sW, sX + normDx));
					nY = Math.max(0, Math.min(1.0 - sH, sY + normDy));
					nW = sW;
					nH = sH;
				}

				const next: [number, number, number, number] = [nX, nY, nW, nH];
				setNormBounds(next);
				dragRef.current.normBounds = next;
			},
			onPanResponderRelease: () => {
				setActiveTarget(null);
				dragRef.current.activeTarget = null;
			},
			onPanResponderTerminate: () => {
				setActiveTarget(null);
				dragRef.current.activeTarget = null;
			},
		});
	};

	const responderTL = useRef(createCornerResponder("TL")).current;
	const responderTR = useRef(createCornerResponder("TR")).current;
	const responderBL = useRef(createCornerResponder("BL")).current;
	const responderBR = useRef(createCornerResponder("BR")).current;
	const responderCenter = useRef(createCornerResponder("CENTER")).current;

	const handleReset = () => {
		const def: [number, number, number, number] = [0.18, 0.28, 0.64, 0.22];
		setNormBounds(def);
		dragRef.current.normBounds = def;
	};

	const handleApply = () => {
		onConfirmCrop(normBounds);
		onClose();
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={false}
			onRequestClose={onClose}
		>
			<SafeAreaView style={styles.modalRoot}>
				{/* HEADER BAR */}
				<View style={styles.header}>
					<Pressable onPress={onClose} style={styles.headerBtn} hitSlop={10}>
						<Text style={styles.headerBtnText}>Cancel</Text>
					</Pressable>
					<View style={styles.headerTitleWrap}>
						<Text style={styles.headerTitle}>Manual LCD Cropper</Text>
						<Text style={styles.headerSub}>
							Drag corners to frame LCD digits
						</Text>
					</View>
					<Pressable
						onPress={handleReset}
						style={styles.headerBtn}
						hitSlop={10}
					>
						<Text style={styles.resetBtnText}>Reset</Text>
					</Pressable>
				</View>

				{/* INTERACTIVE CROP CANVAS */}
				<View
					style={styles.canvas}
					onLayout={(e) => {
						const { width, height } = e.nativeEvent.layout;
						setLayoutDims({ w: width, h: height });
					}}
				>
					{imageUri ? (
						<Image
							source={{ uri: imageUri }}
							style={styles.fullImage}
							contentFit="contain"
							transition={100}
						/>
					) : (
						<View style={styles.loaderCenter}>
							<ActivityIndicator size="large" color="#2563EB" />
						</View>
					)}

					{/* CAMSCANNER DIMMED MASK OVERLAYS */}
					{layoutDims && imageDims && (
						<>
							{/* Top Dimmed Area */}
							<View
								style={[
									styles.dimmedArea,
									{ top: 0, left: 0, right: 0, height: Math.max(0, boxTop) },
								]}
								pointerEvents="none"
							/>
							{/* Bottom Dimmed Area */}
							<View
								style={[
									styles.dimmedArea,
									{
										top: boxTop + boxHeight,
										left: 0,
										right: 0,
										bottom: 0,
									},
								]}
								pointerEvents="none"
							/>
							{/* Left Dimmed Area */}
							<View
								style={[
									styles.dimmedArea,
									{
										top: boxTop,
										left: 0,
										width: Math.max(0, boxLeft),
										height: boxHeight,
									},
								]}
								pointerEvents="none"
							/>
							{/* Right Dimmed Area */}
							<View
								style={[
									styles.dimmedArea,
									{
										top: boxTop,
										left: boxLeft + boxWidth,
										right: 0,
										height: boxHeight,
									},
								]}
								pointerEvents="none"
							/>

							{/* ACTIVE LCD CROP BOX */}
							<View
								style={[
									styles.cropBox,
									{
										left: boxLeft,
										top: boxTop,
										width: boxWidth,
										height: boxHeight,
									},
								]}
								{...responderCenter.panHandlers}
							>
								{/* Grid Rule-of-Thirds Lines */}
								<View style={styles.gridH1} pointerEvents="none" />
								<View style={styles.gridH2} pointerEvents="none" />
								<View style={styles.gridV1} pointerEvents="none" />
								<View style={styles.gridV2} pointerEvents="none" />

								{/* Center drag hint badge */}
								<View style={styles.centerBadge} pointerEvents="none">
									<AppSymbol name="meter" size={12} color="#60A5FA" />
									<Text style={styles.centerBadgeText}>LCD ACTIVE REGION</Text>
								</View>
							</View>

							{/* CORNER TOUCH HANDLERS (4 PINS) */}
							{/* Top-Left */}
							<View
								style={[
									styles.handleWrapper,
									{
										left: boxLeft - HANDLE_SIZE / 2,
										top: boxTop - HANDLE_SIZE / 2,
									},
								]}
								{...responderTL.panHandlers}
							>
								<View
									style={[
										styles.handlePin,
										activeTarget === "TL" && styles.handlePinActive,
									]}
								/>
							</View>

							{/* Top-Right */}
							<View
								style={[
									styles.handleWrapper,
									{
										left: boxLeft + boxWidth - HANDLE_SIZE / 2,
										top: boxTop - HANDLE_SIZE / 2,
									},
								]}
								{...responderTR.panHandlers}
							>
								<View
									style={[
										styles.handlePin,
										activeTarget === "TR" && styles.handlePinActive,
									]}
								/>
							</View>

							{/* Bottom-Left */}
							<View
								style={[
									styles.handleWrapper,
									{
										left: boxLeft - HANDLE_SIZE / 2,
										top: boxTop + boxHeight - HANDLE_SIZE / 2,
									},
								]}
								{...responderBL.panHandlers}
							>
								<View
									style={[
										styles.handlePin,
										activeTarget === "BL" && styles.handlePinActive,
									]}
								/>
							</View>

							{/* Bottom-Right */}
							<View
								style={[
									styles.handleWrapper,
									{
										left: boxLeft + boxWidth - HANDLE_SIZE / 2,
										top: boxTop + boxHeight - HANDLE_SIZE / 2,
									},
								]}
								{...responderBR.panHandlers}
							>
								<View
									style={[
										styles.handlePin,
										activeTarget === "BR" && styles.handlePinActive,
									]}
								/>
							</View>
						</>
					)}
				</View>

				{/* BOTTOM ACTIONS BAR */}
				<View style={styles.bottomBar}>
					<View style={styles.bottomTipRow}>
						<AppSymbol name="check" size={14} color="#10B981" />
						<Text style={styles.bottomTipText}>
							Excludes spec bars (240V, 50Hz) and serial barcodes
						</Text>
					</View>

					<Pressable style={styles.confirmBtn} onPress={handleApply}>
						<AppSymbol name="check" size={18} color="#FFFFFF" />
						<Text style={styles.confirmBtnText}>Apply Clean LCD Crop</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalRoot: {
		flex: 1,
		backgroundColor: "#090A0D",
	},
	header: {
		height: 56,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
		backgroundColor: "#0E1014",
	},
	headerBtn: {
		paddingVertical: 8,
		paddingHorizontal: 10,
	},
	headerBtnText: {
		color: "#94A3B8",
		fontSize: 14,
		fontWeight: "500",
	},
	resetBtnText: {
		color: "#38BDF8",
		fontSize: 14,
		fontWeight: "600",
	},
	headerTitleWrap: {
		alignItems: "center",
	},
	headerTitle: {
		color: "#F8FAFC",
		fontSize: 15,
		fontWeight: "700",
	},
	headerSub: {
		color: "#64748B",
		fontSize: 11,
		marginTop: 1,
	},
	canvas: {
		flex: 1,
		position: "relative",
		backgroundColor: "#000000",
		justifyContent: "center",
		alignItems: "center",
	},
	fullImage: {
		width: "100%",
		height: "100%",
	},
	loaderCenter: {
		...StyleSheet.absoluteFill,
		justifyContent: "center",
		alignItems: "center",
	},
	dimmedArea: {
		position: "absolute",
		backgroundColor: "rgba(0, 0, 0, 0.68)",
	},
	cropBox: {
		position: "absolute",
		borderWidth: 2,
		borderColor: "#38BDF8",
		backgroundColor: "rgba(56, 189, 248, 0.08)",
	},
	gridH1: {
		position: "absolute",
		top: "33.3%",
		left: 0,
		right: 0,
		height: 1,
		backgroundColor: "rgba(255, 255, 255, 0.25)",
	},
	gridH2: {
		position: "absolute",
		top: "66.6%",
		left: 0,
		right: 0,
		height: 1,
		backgroundColor: "rgba(255, 255, 255, 0.25)",
	},
	gridV1: {
		position: "absolute",
		left: "33.3%",
		top: 0,
		bottom: 0,
		width: 1,
		backgroundColor: "rgba(255, 255, 255, 0.25)",
	},
	gridV2: {
		position: "absolute",
		left: "66.6%",
		top: 0,
		bottom: 0,
		width: 1,
		backgroundColor: "rgba(255, 255, 255, 0.25)",
	},
	centerBadge: {
		position: "absolute",
		top: 6,
		left: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: "rgba(15, 23, 42, 0.8)",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		borderWidth: 1,
		borderColor: "rgba(56, 189, 248, 0.3)",
	},
	centerBadgeText: {
		color: "#60A5FA",
		fontSize: 9,
		fontFamily: Fonts.mono,
		fontWeight: "700",
		letterSpacing: 0.5,
	},
	handleWrapper: {
		position: "absolute",
		width: HANDLE_SIZE + 24,
		height: HANDLE_SIZE + 24,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 50,
	},
	handlePin: {
		width: HANDLE_SIZE,
		height: HANDLE_SIZE,
		borderRadius: HANDLE_SIZE / 2,
		backgroundColor: "#FFFFFF",
		borderWidth: 4,
		borderColor: "#0284C7",
		elevation: 6,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.4,
		shadowRadius: 3,
	},
	handlePinActive: {
		transform: [{ scale: 1.25 }],
		borderColor: "#38BDF8",
		backgroundColor: "#E0F2FE",
	},
	bottomBar: {
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 16,
		backgroundColor: "#0E1014",
		borderTopWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
	},
	bottomTipRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginBottom: 10,
		justifyContent: "center",
	},
	bottomTipText: {
		color: "#94A3B8",
		fontSize: 12,
	},
	confirmBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: "#0284C7",
		paddingVertical: 14,
		borderRadius: 10,
	},
	confirmBtnText: {
		color: "#FFFFFF",
		fontSize: 15,
		fontWeight: "700",
	},
});
