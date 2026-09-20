import { useRouter } from "expo-router";
import { Accelerometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Fonts, MeterTokens, Spacing } from "@/constants/theme";
import { calculateWallTilt } from "@/services/sensor/leveling";

export default function CaptureScreen() {
	const router = useRouter();
	const [torchActive, setTorchActive] = useState(false);
	const [tilt, setTilt] = useState(0);
	const [isAligned, setIsAligned] = useState(false);

	useEffect(() => {
		Accelerometer.setUpdateInterval(100);
		const subscription = Accelerometer.addListener(({ x, y, z }) => {
			const evaluation = calculateWallTilt(x, y, z);
			setTilt(evaluation.tiltFromVertical);
			setIsAligned(evaluation.isAligned);
		});
		return () => subscription.remove();
	}, []);

	const handleCapture = () => {
		router.push({
			pathname: "/validation",
			params: {
				sn: "EB4820194",
				kwh: "1428.5",
				confidence: "0.962",
				status: "PASS",
				hazard: "",
				imagePath: "/data/user/0/com.novo/files/raw_EB4820194.jpg",
			},
		});
	};

	return (
		<View style={styles.container}>
			{/* 1. TOP HUD */}
			<View style={styles.topHud}>
				<View
					style={[styles.badge, isAligned ? styles.badgeOk : styles.badgeWarn]}
				>
					<Text style={styles.badgeText}>
						TILT: {tilt > 0 ? `+${tilt}°` : `${tilt}°`}{" "}
						{isAligned ? "(PERPENDICULAR)" : "(HOLD 90° TO WALL)"}
					</Text>
				</View>
				<Pressable
					hitSlop={8}
					style={[styles.torchBtn, torchActive && styles.torchBtnActive]}
					onPress={() => setTorchActive(!torchActive)}
				>
					<Text
						style={[styles.torchText, torchActive && styles.torchTextActive]}
					>
						{torchActive ? "TORCH: ON" : "TORCH: OFF"}
					</Text>
				</Pressable>
			</View>

			{/* 2. BOUNDING GUIDES */}
			<View style={styles.reticleContainer}>
				<View style={styles.casingBox}>
					<Text style={styles.guideText}>METER CASING BOUNDARY</Text>
					<View style={styles.displayBox}>
						<Text style={styles.guideTextInner}>7-SEGMENT DISPLAY</Text>
					</View>
					<View style={styles.terminalBox}>
						<Text style={styles.guideTextInner}>TERMINAL COVER & SEALS</Text>
					</View>
				</View>
			</View>

			{/* 3. CAPTURE TRIGGER */}
			<View style={styles.bottomBar}>
				<Pressable
					disabled={!isAligned}
					style={[styles.captureBtn, !isAligned && styles.captureBtnDisabled]}
					onPress={handleCapture}
				>
					<Text style={styles.captureText}>
						{isAligned
							? "RUN ON-DEVICE INFERENCE (< 250ms)"
							: "ALIGN DEVICE TO 90° (±10°)"}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#000000" },
	topHud: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: Spacing.md,
		paddingTop: 54,
		zIndex: 10,
	},
	badge: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 4,
		justifyContent: "center",
	},
	badgeOk: { backgroundColor: MeterTokens.ok },
	badgeWarn: { backgroundColor: MeterTokens.warn },
	badgeText: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	torchBtn: {
		minHeight: 48,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: "#FFFFFF",
		borderRadius: 4,
		justifyContent: "center",
		alignItems: "center",
	},
	torchBtnActive: { backgroundColor: "#FFFFFF" },
	torchText: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	torchTextActive: { color: "#000000" },
	reticleContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.lg,
	},
	casingBox: {
		width: "100%",
		height: "75%",
		borderWidth: 1.5,
		borderColor: "rgba(255,255,255,0.6)",
		borderStyle: "dashed",
		justifyContent: "space-between",
		padding: Spacing.md,
	},
	displayBox: {
		height: 70,
		borderWidth: 1.5,
		borderColor: "#38BDF8",
		backgroundColor: "rgba(56, 189, 248, 0.08)",
		justifyContent: "center",
		alignItems: "center",
	},
	terminalBox: {
		height: 110,
		borderWidth: 1.5,
		borderColor: "#FBBF24",
		backgroundColor: "rgba(251, 191, 36, 0.08)",
		justifyContent: "center",
		alignItems: "center",
	},
	guideText: {
		fontFamily: Fonts.mono,
		fontSize: 10,
		color: "rgba(255,255,255,0.7)",
	},
	guideTextInner: {
		fontFamily: Fonts.mono,
		fontSize: 10,
		color: "#FFFFFF",
		fontWeight: "700",
	},
	bottomBar: {
		padding: Spacing.md,
		paddingBottom: Spacing.xl,
		backgroundColor: "#000000",
	},
	captureBtn: {
		height: 52,
		backgroundColor: MeterTokens.brand,
		borderRadius: 6,
		justifyContent: "center",
		alignItems: "center",
	},
	captureBtnDisabled: { backgroundColor: "#334155" },
	captureText: {
		fontFamily: Fonts.mono,
		fontSize: 12,
		fontWeight: "700",
		color: "#FFFFFF",
	},
});
