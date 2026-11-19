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

export interface Point {
	x: number;
	y: number;
}

export interface CamScannerCropperModalProps {
	visible: boolean;
	imageUri: string;
	initialBounds?: [number, number, number, number] | null;
	initialPoints?: [Point, Point, Point, Point] | null;
	onClose: () => void;
	onConfirmCrop: (
		bounds: [number, number, number, number],
		points: [Point, Point, Point, Point],
	) => void;
}

type DragTarget =
	| "P0"
	| "P1"
	| "P2"
	| "P3"
	| "M01"
	| "M12"
	| "M23"
	| "M30"
	| "CENTER"
	| null;

const PIN_SIZE = 30;
const EDGE_HANDLE_SIZE = 18;

// Hardware-accelerated connecting vector line component
function VectorLine({
	x1,
	y1,
	x2,
	y2,
}: {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const length = Math.hypot(dx, dy);
	if (length <= 0) return null;
	const angle = Math.atan2(dy, dx);
	const midX = (x1 + x2) / 2;
	const midY = (y1 + y2) / 2;

	return (
		<View
			style={[
				styles.vectorLine,
				{
					left: midX - length / 2,
					top: midY - 1.25,
					width: length,
					transform: [{ rotate: `${angle}rad` }],
				},
			]}
			pointerEvents="none"
		/>
	);
}

export function CamScannerCropperModal({
	visible,
	imageUri,
	initialBounds,
	initialPoints,
	onClose,
	onConfirmCrop,
}: CamScannerCropperModalProps) {
	const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(
		null,
	);
	const [layoutDims, setLayoutDims] = useState<{ w: number; h: number } | null>(
		null,
	);

	// 4 independent normalized points: P0=TL, P1=TR, P2=BR, P3=BL (0..1 range)
	const [points, setPoints] = useState<[Point, Point, Point, Point]>(() => {
		if (initialPoints && initialPoints.length === 4) {
			return initialPoints;
		}
		if (initialBounds && initialBounds.length === 4) {
			const [x, y, w, h] = initialBounds;
			return [
				{ x, y },
				{ x: x + w, y },
				{ x: x + w, y: y + h },
				{ x, y: y + h },
			];
		}
		return [
			{ x: 0.18, y: 0.28 },
			{ x: 0.82, y: 0.28 },
			{ x: 0.82, y: 0.5 },
			{ x: 0.18, y: 0.5 },
		];
	});

	const [activeTarget, setActiveTarget] = useState<DragTarget>(null);

	// Ref to hold live mutable state during 60fps pan gestures
	const dragRef = useRef({
		points: [
			{ x: 0.18, y: 0.28 },
			{ x: 0.82, y: 0.28 },
			{ x: 0.82, y: 0.5 },
			{ x: 0.18, y: 0.5 },
		] as [Point, Point, Point, Point],
		startPoints: [
			{ x: 0.18, y: 0.28 },
			{ x: 0.82, y: 0.28 },
			{ x: 0.82, y: 0.5 },
			{ x: 0.18, y: 0.5 },
		] as [Point, Point, Point, Point],
		startX: 0,
		startY: 0,
		dispX: 0,
		dispY: 0,
		dispW: 1,
		dispH: 1,
	});

	// Load image dimensions
	useEffect(() => {
		if (!imageUri || !visible) return;
		manipulateAsync(imageUri, [])
			.then((probe) => setImageDims({ w: probe.width, h: probe.height }))
			.catch(() => setImageDims({ w: 1080, h: 1920 }));
	}, [imageUri, visible]);

	// Initialize points on show
	useEffect(() => {
		if (visible) {
			let pts: [Point, Point, Point, Point];
			if (initialPoints && initialPoints.length === 4) {
				pts = initialPoints;
			} else if (initialBounds && initialBounds.length === 4) {
				const [x, y, w, h] = initialBounds;
				pts = [
					{ x, y },
					{ x: x + w, y },
					{ x: x + w, y: y + h },
					{ x, y: y + h },
				];
			} else {
				pts = [
					{ x: 0.18, y: 0.28 },
					{ x: 0.82, y: 0.28 },
					{ x: 0.82, y: 0.5 },
					{ x: 0.18, y: 0.5 },
				];
			}
			setPoints(pts);
			dragRef.current.points = pts;
		}
	}, [visible, initialBounds, initialPoints]);

	useEffect(() => {
		dragRef.current.points = points;
	}, [points]);

	// Geometry calculations
	const getGeometry = () => {
		if (!imageDims || !layoutDims || layoutDims.w === 0 || layoutDims.h === 0) {
			return { dispX: 0, dispY: 0, dispW: 1, dispH: 1 };
		}
		const scale = Math.min(
			layoutDims.w / imageDims.w,
			layoutDims.h / imageDims.h,
		);
		const dispW = imageDims.w * scale;
		const dispH = imageDims.h * scale;
		const dispX = (layoutDims.w - dispW) / 2;
		const dispY = (layoutDims.h - dispH) / 2;
		return { dispX, dispY, dispW, dispH };
	};

	const { dispX, dispY, dispW, dispH } = getGeometry();
	dragRef.current.dispX = dispX;
	dragRef.current.dispY = dispY;
	dragRef.current.dispW = dispW;
	dragRef.current.dispH = dispH;

	// Screen coordinates for each of the 4 independent points
	const sP0 = {
		x: dispX + points[0].x * dispW,
		y: dispY + points[0].y * dispH,
	};
	const sP1 = {
		x: dispX + points[1].x * dispW,
		y: dispY + points[1].y * dispH,
	};
	const sP2 = {
		x: dispX + points[2].x * dispW,
		y: dispY + points[2].y * dispH,
	};
	const sP3 = {
		x: dispX + points[3].x * dispW,
		y: dispY + points[3].y * dispH,
	};

	// Edge midpoints
	const sM01 = { x: (sP0.x + sP1.x) / 2, y: (sP0.y + sP1.y) / 2 };
	const sM12 = { x: (sP1.x + sP2.x) / 2, y: (sP1.y + sP2.y) / 2 };
	const sM23 = { x: (sP2.x + sP3.x) / 2, y: (sP2.y + sP3.y) / 2 };
	const sM30 = { x: (sP3.x + sP0.x) / 2, y: (sP3.y + sP0.y) / 2 };

	// Polygon centroid
	const sCenter = {
		x: (sP0.x + sP1.x + sP2.x + sP3.x) / 4,
		y: (sP0.y + sP1.y + sP2.y + sP3.y) / 4,
	};

	// Universal PanResponder factory for independent corner and edge dragging
	const createTargetResponder = (target: DragTarget) => {
		return PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: (evt) => {
				setActiveTarget(target);
				dragRef.current.startX = evt.nativeEvent.pageX;
				dragRef.current.startY = evt.nativeEvent.pageY;
				dragRef.current.startPoints = dragRef.current.points.map((p) => ({
					...p,
				})) as [Point, Point, Point, Point];
			},
			onPanResponderMove: (evt) => {
				const dx = evt.nativeEvent.pageX - dragRef.current.startX;
				const dy = evt.nativeEvent.pageY - dragRef.current.startY;
				const curDispW = dragRef.current.dispW;
				const curDispH = dragRef.current.dispH;
				if (curDispW <= 0 || curDispH <= 0) return;

				const normDx = dx / curDispW;
				const normDy = dy / curDispH;
				const startPts = dragRef.current.startPoints;

				const next: [Point, Point, Point, Point] = [
					{ ...startPts[0] },
					{ ...startPts[1] },
					{ ...startPts[2] },
					{ ...startPts[3] },
				];

				const clamp = (v: number) => Math.max(0, Math.min(1.0, v));

				if (target === "P0") {
					// Free movement of Top-Left dot
					next[0] = {
						x: clamp(startPts[0].x + normDx),
						y: clamp(startPts[0].y + normDy),
					};
				} else if (target === "P1") {
					// Free movement of Top-Right dot
					next[1] = {
						x: clamp(startPts[1].x + normDx),
						y: clamp(startPts[1].y + normDy),
					};
				} else if (target === "P2") {
					// Free movement of Bottom-Right dot
					next[2] = {
						x: clamp(startPts[2].x + normDx),
						y: clamp(startPts[2].y + normDy),
					};
				} else if (target === "P3") {
					// Free movement of Bottom-Left dot
					next[3] = {
						x: clamp(startPts[3].x + normDx),
						y: clamp(startPts[3].y + normDy),
					};
				} else if (target === "M01") {
					// Move top edge (P0 and P1 in parallel)
					next[0] = {
						x: clamp(startPts[0].x + normDx),
						y: clamp(startPts[0].y + normDy),
					};
					next[1] = {
						x: clamp(startPts[1].x + normDx),
						y: clamp(startPts[1].y + normDy),
					};
				} else if (target === "M12") {
					// Move right edge (P1 and P2 in parallel)
					next[1] = {
						x: clamp(startPts[1].x + normDx),
						y: clamp(startPts[1].y + normDy),
					};
					next[2] = {
						x: clamp(startPts[2].x + normDx),
						y: clamp(startPts[2].y + normDy),
					};
				} else if (target === "M23") {
					// Move bottom edge (P2 and P3 in parallel)
					next[2] = {
						x: clamp(startPts[2].x + normDx),
						y: clamp(startPts[2].y + normDy),
					};
					next[3] = {
						x: clamp(startPts[3].x + normDx),
						y: clamp(startPts[3].y + normDy),
					};
				} else if (target === "M30") {
					// Move left edge (P3 and P0 in parallel)
					next[3] = {
						x: clamp(startPts[3].x + normDx),
						y: clamp(startPts[3].y + normDy),
					};
					next[0] = {
						x: clamp(startPts[0].x + normDx),
						y: clamp(startPts[0].y + normDy),
					};
				} else if (target === "CENTER") {
					// Translate whole quadrilateral
					for (let i = 0; i < 4; i++) {
						next[i] = {
							x: clamp(startPts[i].x + normDx),
							y: clamp(startPts[i].y + normDy),
						};
					}
				}

				setPoints(next);
				dragRef.current.points = next;
			},
			onPanResponderRelease: () => {
				setActiveTarget(null);
			},
			onPanResponderTerminate: () => {
				setActiveTarget(null);
			},
		});
	};

	const respP0 = useRef(createTargetResponder("P0")).current;
	const respP1 = useRef(createTargetResponder("P1")).current;
	const respP2 = useRef(createTargetResponder("P2")).current;
	const respP3 = useRef(createTargetResponder("P3")).current;
	const respM01 = useRef(createTargetResponder("M01")).current;
	const respM12 = useRef(createTargetResponder("M12")).current;
	const respM23 = useRef(createTargetResponder("M23")).current;
	const respM30 = useRef(createTargetResponder("M30")).current;
	const respCenter = useRef(createTargetResponder("CENTER")).current;

	const handleReset = () => {
		const def: [Point, Point, Point, Point] = [
			{ x: 0.18, y: 0.28 },
			{ x: 0.82, y: 0.28 },
			{ x: 0.82, y: 0.5 },
			{ x: 0.18, y: 0.5 },
		];
		setPoints(def);
		dragRef.current.points = def;
	};

	const handleApply = () => {
		// Calculate the axis-aligned envelope bounds [minX, minY, width, height]
		const minX = Math.min(points[0].x, points[1].x, points[2].x, points[3].x);
		const minY = Math.min(points[0].y, points[1].y, points[2].y, points[3].y);
		const maxX = Math.max(points[0].x, points[1].x, points[2].x, points[3].x);
		const maxY = Math.max(points[0].y, points[1].y, points[2].y, points[3].y);
		const bounds: [number, number, number, number] = [
			minX,
			minY,
			Math.max(0.05, maxX - minX),
			Math.max(0.05, maxY - minY),
		];
		onConfirmCrop(bounds, points);
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
						<Text style={styles.headerTitle}>CamScanner 4-Dot Crop</Text>
						<Text style={styles.headerSub}>
							Move dots freely to frame LCD display
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

				{/* CANVAS CONTAINER */}
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
							<ActivityIndicator size="large" color="#0284C7" />
						</View>
					)}

					{layoutDims && imageDims && (
						<>
							{/* 4 DYNAMIC VECTOR CONNECTING LINES */}
							<VectorLine x1={sP0.x} y1={sP0.y} x2={sP1.x} y2={sP1.y} />
							<VectorLine x1={sP1.x} y1={sP1.y} x2={sP2.x} y2={sP2.y} />
							<VectorLine x1={sP2.x} y1={sP2.y} x2={sP3.x} y2={sP3.y} />
							<VectorLine x1={sP3.x} y1={sP3.y} x2={sP0.x} y2={sP0.y} />

							{/* CENTER PAN DRAGGER */}
							<View
								style={[
									styles.centerDragger,
									{
										left: sCenter.x - 45,
										top: sCenter.y - 14,
									},
								]}
								{...respCenter.panHandlers}
							>
								<AppSymbol name="meter" size={12} color="#60A5FA" />
								<Text style={styles.centerDraggerText}>MOVE ALL</Text>
							</View>

							{/* 4 EDGE MIDPOINT HANDLERS */}
							{/* Top Edge Handle */}
							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM01.x - EDGE_HANDLE_SIZE / 2 - 10,
										top: sM01.y - EDGE_HANDLE_SIZE / 2 - 10,
									},
								]}
								{...respM01.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							{/* Right Edge Handle */}
							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM12.x - EDGE_HANDLE_SIZE / 2 - 10,
										top: sM12.y - EDGE_HANDLE_SIZE / 2 - 10,
									},
								]}
								{...respM12.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							{/* Bottom Edge Handle */}
							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM23.x - EDGE_HANDLE_SIZE / 2 - 10,
										top: sM23.y - EDGE_HANDLE_SIZE / 2 - 10,
									},
								]}
								{...respM23.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							{/* Left Edge Handle */}
							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM30.x - EDGE_HANDLE_SIZE / 2 - 10,
										top: sM30.y - EDGE_HANDLE_SIZE / 2 - 10,
									},
								]}
								{...respM30.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							{/* 4 INDEPENDENT CORNER PINS (FREELY MOVABLE) */}
							{/* P0: Top-Left */}
							<View
								style={[
									styles.pinWrap,
									{
										left: sP0.x - (PIN_SIZE + 24) / 2,
										top: sP0.y - (PIN_SIZE + 24) / 2,
									},
								]}
								{...respP0.panHandlers}
							>
								<View
									style={[
										styles.pinDot,
										activeTarget === "P0" && styles.pinDotActive,
									]}
								>
									<View style={styles.pinInnerDot} />
								</View>
							</View>

							{/* P1: Top-Right */}
							<View
								style={[
									styles.pinWrap,
									{
										left: sP1.x - (PIN_SIZE + 24) / 2,
										top: sP1.y - (PIN_SIZE + 24) / 2,
									},
								]}
								{...respP1.panHandlers}
							>
								<View
									style={[
										styles.pinDot,
										activeTarget === "P1" && styles.pinDotActive,
									]}
								>
									<View style={styles.pinInnerDot} />
								</View>
							</View>

							{/* P2: Bottom-Right */}
							<View
								style={[
									styles.pinWrap,
									{
										left: sP2.x - (PIN_SIZE + 24) / 2,
										top: sP2.y - (PIN_SIZE + 24) / 2,
									},
								]}
								{...respP2.panHandlers}
							>
								<View
									style={[
										styles.pinDot,
										activeTarget === "P2" && styles.pinDotActive,
									]}
								>
									<View style={styles.pinInnerDot} />
								</View>
							</View>

							{/* P3: Bottom-Left */}
							<View
								style={[
									styles.pinWrap,
									{
										left: sP3.x - (PIN_SIZE + 24) / 2,
										top: sP3.y - (PIN_SIZE + 24) / 2,
									},
								]}
								{...respP3.panHandlers}
							>
								<View
									style={[
										styles.pinDot,
										activeTarget === "P3" && styles.pinDotActive,
									]}
								>
									<View style={styles.pinInnerDot} />
								</View>
							</View>
						</>
					)}
				</View>

				{/* BOTTOM CONTROL ACTIONS */}
				<View style={styles.bottomBar}>
					<View style={styles.bottomTipRow}>
						<AppSymbol name="check" size={14} color="#10B981" />
						<Text style={styles.bottomTipText}>
							Encloses 4-point polygon & rectifies perspective distortion
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
	vectorLine: {
		position: "absolute",
		height: 2.5,
		backgroundColor: "#38BDF8",
		elevation: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.5,
		shadowRadius: 2,
	},
	pinWrap: {
		position: "absolute",
		width: PIN_SIZE + 24,
		height: PIN_SIZE + 24,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 100,
	},
	pinDot: {
		width: PIN_SIZE,
		height: PIN_SIZE,
		borderRadius: PIN_SIZE / 2,
		backgroundColor: "#FFFFFF",
		borderWidth: 4,
		borderColor: "#0284C7",
		justifyContent: "center",
		alignItems: "center",
		elevation: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.5,
		shadowRadius: 4,
	},
	pinDotActive: {
		transform: [{ scale: 1.3 }],
		borderColor: "#38BDF8",
		backgroundColor: "#E0F2FE",
	},
	pinInnerDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#0284C7",
	},
	edgeHandleWrap: {
		position: "absolute",
		width: EDGE_HANDLE_SIZE + 20,
		height: EDGE_HANDLE_SIZE + 20,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 80,
	},
	edgeHandlePin: {
		width: EDGE_HANDLE_SIZE,
		height: EDGE_HANDLE_SIZE,
		borderRadius: EDGE_HANDLE_SIZE / 2,
		backgroundColor: "#38BDF8",
		borderWidth: 2,
		borderColor: "#FFFFFF",
		elevation: 6,
	},
	centerDragger: {
		position: "absolute",
		width: 90,
		height: 28,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		backgroundColor: "rgba(15, 23, 42, 0.85)",
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "rgba(56, 189, 248, 0.4)",
		zIndex: 70,
	},
	centerDraggerText: {
		color: "#60A5FA",
		fontSize: 10,
		fontFamily: Fonts.mono,
		fontWeight: "700",
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
