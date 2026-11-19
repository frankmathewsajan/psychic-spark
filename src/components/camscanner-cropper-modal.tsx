import { Image } from "expo-image";
import { manipulateAsync } from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	PanResponder,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

const VISUAL_PIN_SIZE = 16;
const TOUCH_PIN_SIZE = 48;
const VISUAL_EDGE_SIZE = 10;
const TOUCH_EDGE_SIZE = 36;
const LOUPE_SIZE = 100;
const LOUPE_ZOOM = 2.8;

// Precision thin vector connecting line component (1.5px)
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
					top: midY - 0.75,
					width: length,
					transform: [{ rotate: `${angle}rad` }],
				},
			]}
			pointerEvents="none"
		/>
	);
}

// Floating Magnifying Loupe (CamScanner style)
function MagnifyingLoupe({
	imageUri,
	targetPoint,
	screenX,
	screenY,
	dispW,
	dispH,
	layoutW,
}: {
	imageUri: string;
	targetPoint: Point;
	screenX: number;
	screenY: number;
	dispW: number;
	dispH: number;
	layoutW: number;
}) {
	const radius = LOUPE_SIZE / 2;
	// Float 85px above the touch coordinate, or below if near top
	let top = screenY - LOUPE_SIZE - 25;
	if (top < 10) {
		top = screenY + 40;
	}
	let left = screenX - radius;
	if (left < 10) left = 10;
	if (left > layoutW - LOUPE_SIZE - 10) left = layoutW - LOUPE_SIZE - 10;

	// Image coordinates inside loupe centered on the pin
	const imgW = dispW * LOUPE_ZOOM;
	const imgH = dispH * LOUPE_ZOOM;
	const imgLeft = -(targetPoint.x * dispW * LOUPE_ZOOM) + radius;
	const imgTop = -(targetPoint.y * dispH * LOUPE_ZOOM) + radius;

	return (
		<View style={[styles.loupeContainer, { top, left }]} pointerEvents="none">
			<Image
				source={{ uri: imageUri }}
				style={{
					position: "absolute",
					width: imgW,
					height: imgH,
					left: imgLeft,
					top: imgTop,
				}}
				contentFit="fill"
			/>
			{/* Crosshair Overlay */}
			<View style={styles.loupeCrosshairH} />
			<View style={styles.loupeCrosshairV} />
			<View style={styles.loupeCenterDot} />
		</View>
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
	const [zoomLevel, setZoomLevel] = useState<1 | 2>(1);

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
			setZoomLevel(1);
		}
	}, [visible, initialBounds, initialPoints]);

	useEffect(() => {
		dragRef.current.points = points;
	}, [points]);

	// Geometry calculations with zoom support
	const getGeometry = () => {
		if (!imageDims || !layoutDims || layoutDims.w === 0 || layoutDims.h === 0) {
			return { dispX: 0, dispY: 0, dispW: 1, dispH: 1 };
		}
		const baseScale = Math.min(
			layoutDims.w / imageDims.w,
			layoutDims.h / imageDims.h,
		);
		const baseW = imageDims.w * baseScale;
		const baseH = imageDims.h * baseScale;

		if (zoomLevel === 1) {
			const dispX = (layoutDims.w - baseW) / 2;
			const dispY = (layoutDims.h - baseH) / 2;
			return { dispX, dispY, dispW: baseW, dispH: baseH };
		}

		// In 2x zoom mode, center on the centroid of the current 4 points
		const normCenterX =
			(points[0].x + points[1].x + points[2].x + points[3].x) / 4;
		const normCenterY =
			(points[0].y + points[1].y + points[2].y + points[3].y) / 4;

		const dispW = baseW * 2;
		const dispH = baseH * 2;
		const dispX = layoutDims.w / 2 - normCenterX * dispW;
		const dispY = layoutDims.h / 2 - normCenterY * dispH;

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

	// Active drag point info for the magnifying loupe
	let activeLoupeData: {
		point: Point;
		screenX: number;
		screenY: number;
	} | null = null;
	if (activeTarget === "P0") {
		activeLoupeData = { point: points[0], screenX: sP0.x, screenY: sP0.y };
	} else if (activeTarget === "P1") {
		activeLoupeData = { point: points[1], screenX: sP1.x, screenY: sP1.y };
	} else if (activeTarget === "P2") {
		activeLoupeData = { point: points[2], screenX: sP2.x, screenY: sP2.y };
	} else if (activeTarget === "P3") {
		activeLoupeData = { point: points[3], screenX: sP3.x, screenY: sP3.y };
	}

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
					next[0] = {
						x: clamp(startPts[0].x + normDx),
						y: clamp(startPts[0].y + normDy),
					};
				} else if (target === "P1") {
					next[1] = {
						x: clamp(startPts[1].x + normDx),
						y: clamp(startPts[1].y + normDy),
					};
				} else if (target === "P2") {
					next[2] = {
						x: clamp(startPts[2].x + normDx),
						y: clamp(startPts[2].y + normDy),
					};
				} else if (target === "P3") {
					next[3] = {
						x: clamp(startPts[3].x + normDx),
						y: clamp(startPts[3].y + normDy),
					};
				} else if (target === "M01") {
					next[0] = {
						x: clamp(startPts[0].x + normDx),
						y: clamp(startPts[0].y + normDy),
					};
					next[1] = {
						x: clamp(startPts[1].x + normDx),
						y: clamp(startPts[1].y + normDy),
					};
				} else if (target === "M12") {
					next[1] = {
						x: clamp(startPts[1].x + normDx),
						y: clamp(startPts[1].y + normDy),
					};
					next[2] = {
						x: clamp(startPts[2].x + normDx),
						y: clamp(startPts[2].y + normDy),
					};
				} else if (target === "M23") {
					next[2] = {
						x: clamp(startPts[2].x + normDx),
						y: clamp(startPts[2].y + normDy),
					};
					next[3] = {
						x: clamp(startPts[3].x + normDx),
						y: clamp(startPts[3].y + normDy),
					};
				} else if (target === "M30") {
					next[3] = {
						x: clamp(startPts[3].x + normDx),
						y: clamp(startPts[3].y + normDy),
					};
					next[0] = {
						x: clamp(startPts[0].x + normDx),
						y: clamp(startPts[0].y + normDy),
					};
				} else if (target === "CENTER") {
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
			<SafeAreaView style={styles.modalRoot} edges={["top", "bottom"]}>
				{/* HEADER BAR */}
				<View style={styles.header}>
					<Pressable onPress={onClose} style={styles.headerBtn} hitSlop={10}>
						<Text style={styles.headerBtnText}>Cancel</Text>
					</Pressable>

					<View style={styles.headerCenter}>
						<Text style={styles.headerTitle}>Adjust LCD Crop</Text>
						<Text style={styles.headerSub}>
							{zoomLevel === 2
								? "2x Zoom Active"
								: "Move 4 corner pins to digits"}
						</Text>
					</View>

					<View style={styles.headerRight}>
						<Pressable
							onPress={() => setZoomLevel((prev) => (prev === 1 ? 2 : 1))}
							style={[
								styles.zoomChip,
								zoomLevel === 2 && styles.zoomChipActive,
							]}
							hitSlop={6}
						>
							<Text
								style={[
									styles.zoomChipText,
									zoomLevel === 2 && styles.zoomChipTextActive,
								]}
							>
								{zoomLevel === 1 ? "1x Zoom" : "2x Zoom"}
							</Text>
						</Pressable>

						<Pressable
							onPress={handleReset}
							style={styles.headerBtn}
							hitSlop={10}
						>
							<Text style={styles.resetBtnText}>Reset</Text>
						</Pressable>
					</View>
				</View>

				{/* CANVAS CONTAINER */}
				<View
					style={styles.canvas}
					onLayout={(e) => {
						const { width, height } = e.nativeEvent.layout;
						setLayoutDims({ w: width, h: height });
					}}
				>
					{imageUri && layoutDims ? (
						<Image
							source={{ uri: imageUri }}
							style={[
								styles.displayedImage,
								{
									width: dispW,
									height: dispH,
									left: dispX,
									top: dispY,
								},
							]}
							contentFit="fill"
							transition={100}
						/>
					) : (
						<View style={styles.loaderCenter}>
							<ActivityIndicator size="large" color="#0284C7" />
						</View>
					)}

					{layoutDims && imageDims && (
						<>
							{/* 4 DYNAMIC VECTOR CONNECTING LINES (THIN 1.5px) */}
							<VectorLine x1={sP0.x} y1={sP0.y} x2={sP1.x} y2={sP1.y} />
							<VectorLine x1={sP1.x} y1={sP1.y} x2={sP2.x} y2={sP2.y} />
							<VectorLine x1={sP2.x} y1={sP2.y} x2={sP3.x} y2={sP3.y} />
							<VectorLine x1={sP3.x} y1={sP3.y} x2={sP0.x} y2={sP0.y} />

							{/* CENTER PAN DRAGGER */}
							<View
								style={[
									styles.centerDragger,
									{
										left: sCenter.x - 40,
										top: sCenter.y - 12,
									},
								]}
								{...respCenter.panHandlers}
							>
								<AppSymbol name="meter" size={12} color="#60A5FA" />
								<Text style={styles.centerDraggerText}>MOVE ALL</Text>
							</View>

							{/* 4 EDGE MIDPOINT HANDLERS */}
							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM01.x - TOUCH_EDGE_SIZE / 2,
										top: sM01.y - TOUCH_EDGE_SIZE / 2,
									},
								]}
								{...respM01.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM12.x - TOUCH_EDGE_SIZE / 2,
										top: sM12.y - TOUCH_EDGE_SIZE / 2,
									},
								]}
								{...respM12.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM23.x - TOUCH_EDGE_SIZE / 2,
										top: sM23.y - TOUCH_EDGE_SIZE / 2,
									},
								]}
								{...respM23.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							<View
								style={[
									styles.edgeHandleWrap,
									{
										left: sM30.x - TOUCH_EDGE_SIZE / 2,
										top: sM30.y - TOUCH_EDGE_SIZE / 2,
									},
								]}
								{...respM30.panHandlers}
							>
								<View style={styles.edgeHandlePin} />
							</View>

							{/* 4 INDEPENDENT CORNER PINS (THIN RETICLES) */}
							{/* P0: Top-Left */}
							<View
								style={[
									styles.pinWrap,
									{
										left: sP0.x - TOUCH_PIN_SIZE / 2,
										top: sP0.y - TOUCH_PIN_SIZE / 2,
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
										left: sP1.x - TOUCH_PIN_SIZE / 2,
										top: sP1.y - TOUCH_PIN_SIZE / 2,
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
										left: sP2.x - TOUCH_PIN_SIZE / 2,
										top: sP2.y - TOUCH_PIN_SIZE / 2,
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
										left: sP3.x - TOUCH_PIN_SIZE / 2,
										top: sP3.y - TOUCH_PIN_SIZE / 2,
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

							{/* CAMSCANNER FLOATING MAGNIFYING LOUPE */}
							{activeLoupeData && (
								<MagnifyingLoupe
									imageUri={imageUri}
									targetPoint={activeLoupeData.point}
									screenX={activeLoupeData.screenX}
									screenY={activeLoupeData.screenY}
									dispW={dispW}
									dispH={dispH}
									layoutW={layoutDims.w}
								/>
							)}
						</>
					)}
				</View>

				{/* BOTTOM BAR */}
				<View style={styles.bottomBar}>
					<View style={styles.bottomInstruction}>
						<AppSymbol name="edit" size={14} color="#38BDF8" />
						<Text style={styles.bottomInstructionText}>
							{activeTarget
								? "Align crosshair with LCD corner"
								: "Drag corner dots to match meter screen"}
						</Text>
					</View>

					<Pressable style={styles.applyBtn} onPress={handleApply} hitSlop={6}>
						<AppSymbol name="check" size={18} color="#FFFFFF" />
						<Text style={styles.applyBtnText}>Apply Clean Crop</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalRoot: {
		flex: 1,
		backgroundColor: "#0B0F19",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#1E293B",
	},
	headerBtn: {
		paddingVertical: 4,
		paddingHorizontal: 6,
	},
	headerBtnText: {
		color: "#94A3B8",
		fontSize: 14,
		fontWeight: "600",
	},
	headerCenter: {
		alignItems: "center",
	},
	headerTitle: {
		color: "#F8FAFC",
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0.3,
	},
	headerSub: {
		color: "#38BDF8",
		fontSize: 10,
		fontFamily: Fonts.mono,
		marginTop: 2,
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	zoomChip: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
		backgroundColor: "#1E293B",
		borderWidth: 1,
		borderColor: "#334155",
	},
	zoomChipActive: {
		backgroundColor: "rgba(56, 189, 248, 0.2)",
		borderColor: "#38BDF8",
	},
	zoomChipText: {
		color: "#94A3B8",
		fontSize: 11,
		fontFamily: Fonts.mono,
		fontWeight: "700",
	},
	zoomChipTextActive: {
		color: "#38BDF8",
	},
	resetBtnText: {
		color: "#F59E0B",
		fontSize: 13,
		fontWeight: "600",
	},
	canvas: {
		flex: 1,
		position: "relative",
		backgroundColor: "#000000",
		overflow: "hidden",
	},
	displayedImage: {
		position: "absolute",
	},
	loaderCenter: {
		...StyleSheet.absoluteFill,
		justifyContent: "center",
		alignItems: "center",
	},
	vectorLine: {
		position: "absolute",
		height: 1.5,
		backgroundColor: "#38BDF8",
		zIndex: 30,
		shadowColor: "#38BDF8",
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.8,
		shadowRadius: 2,
	},
	pinWrap: {
		position: "absolute",
		width: TOUCH_PIN_SIZE,
		height: TOUCH_PIN_SIZE,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 90,
	},
	pinDot: {
		width: VISUAL_PIN_SIZE,
		height: VISUAL_PIN_SIZE,
		borderRadius: VISUAL_PIN_SIZE / 2,
		backgroundColor: "#FFFFFF",
		borderWidth: 2,
		borderColor: "#0284C7",
		justifyContent: "center",
		alignItems: "center",
		elevation: 6,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.4,
		shadowRadius: 2,
	},
	pinDotActive: {
		transform: [{ scale: 1.25 }],
		borderColor: "#38BDF8",
		backgroundColor: "#E0F2FE",
	},
	pinInnerDot: {
		width: 4,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#0284C7",
	},
	edgeHandleWrap: {
		position: "absolute",
		width: TOUCH_EDGE_SIZE,
		height: TOUCH_EDGE_SIZE,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 70,
	},
	edgeHandlePin: {
		width: VISUAL_EDGE_SIZE,
		height: VISUAL_EDGE_SIZE,
		borderRadius: VISUAL_EDGE_SIZE / 2,
		backgroundColor: "#38BDF8",
		borderWidth: 1.5,
		borderColor: "#FFFFFF",
		elevation: 4,
	},
	centerDragger: {
		position: "absolute",
		width: 80,
		height: 24,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		backgroundColor: "rgba(15, 23, 42, 0.85)",
		borderRadius: 5,
		borderWidth: 1,
		borderColor: "rgba(56, 189, 248, 0.4)",
		zIndex: 60,
	},
	centerDraggerText: {
		color: "#60A5FA",
		fontSize: 9,
		fontFamily: Fonts.mono,
		fontWeight: "700",
		letterSpacing: 0.5,
	},
	loupeContainer: {
		position: "absolute",
		width: LOUPE_SIZE,
		height: LOUPE_SIZE,
		borderRadius: LOUPE_SIZE / 2,
		borderWidth: 2.5,
		borderColor: "#38BDF8",
		backgroundColor: "#000000",
		overflow: "hidden",
		zIndex: 100,
		elevation: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.5,
		shadowRadius: 6,
	},
	loupeCrosshairH: {
		position: "absolute",
		left: LOUPE_SIZE / 2 - 14,
		top: LOUPE_SIZE / 2 - 0.75,
		width: 28,
		height: 1.5,
		backgroundColor: "#38BDF8",
		zIndex: 102,
	},
	loupeCrosshairV: {
		position: "absolute",
		left: LOUPE_SIZE / 2 - 0.75,
		top: LOUPE_SIZE / 2 - 14,
		width: 1.5,
		height: 28,
		backgroundColor: "#38BDF8",
		zIndex: 102,
	},
	loupeCenterDot: {
		position: "absolute",
		left: LOUPE_SIZE / 2 - 2,
		top: LOUPE_SIZE / 2 - 2,
		width: 4,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#FFFFFF",
		zIndex: 103,
	},
	bottomBar: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#0B0F19",
		borderTopWidth: 1,
		borderTopColor: "#1E293B",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	bottomInstruction: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	bottomInstructionText: {
		color: "#94A3B8",
		fontSize: 11,
		flexShrink: 1,
	},
	applyBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#0284C7",
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		elevation: 4,
	},
	applyBtnText: {
		color: "#FFFFFF",
		fontSize: 13,
		fontWeight: "700",
		fontFamily: Fonts.mono,
	},
});
