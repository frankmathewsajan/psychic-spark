import { useEffect, useRef } from "react";
import {
	Animated,
	Easing,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { AppSymbol } from "@/components/app-symbol";
import { Fonts, MD3 } from "@/constants/theme";
import { useTheme } from "@/core/theme-context";

export type SyncStage =
	| "IDLE"
	| "CONNECTING"
	| "METADATA"
	| "MEDIA"
	| "RECONCILING"
	| "COMPLETE"
	| "ERROR";

export interface SyncProgressData {
	active: boolean;
	stage: SyncStage;
	progress: number; // 0.0 to 1.0
	title: string;
	subtitle: string;
	detail?: string;
	badgeText?: string;
	error?: boolean;
}

export interface CloudSyncProgressBarProps {
	data: SyncProgressData;
	onDismiss?: () => void;
}

export function CloudSyncProgressBar({
	data,
	onDismiss,
}: CloudSyncProgressBarProps) {
	const { colors, isDark } = useTheme();

	// Smooth width animation
	const widthAnim = useRef(new Animated.Value(0)).current;
	// Continuous spin animation for loading icon
	const spinAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const target = Math.max(0, Math.min(1, data.progress));
		Animated.timing(widthAnim, {
			toValue: target,
			duration: 280,
			easing: Easing.out(Easing.quad),
			useNativeDriver: false,
		}).start();
	}, [data.progress, widthAnim]);

	useEffect(() => {
		if (data.active && data.stage !== "COMPLETE" && data.stage !== "ERROR") {
			const loop = Animated.loop(
				Animated.timing(spinAnim, {
					toValue: 1,
					duration: 1100,
					easing: Easing.linear,
					useNativeDriver: true,
				}),
			);
			loop.start();
			return () => loop.stop();
		}
		spinAnim.setValue(0);
	}, [data.active, data.stage, spinAnim]);

	if (!data.active && data.stage === "IDLE") {
		return null;
	}

	const spin = spinAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "360deg"],
	});

	const percentNumber = Math.round(
		Math.max(0, Math.min(1, data.progress)) * 100,
	);

	// Determine styling by stage
	let iconName: "sync" | "check" | "warning" = "sync";
	let iconColor: string = MD3.color.primary;
	let fillColor: string = MD3.color.primary;
	let badgeBg: string = isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE";
	let badgeText: string = data.badgeText || "SYNC";
	let badgeTextColor: string = "#0284C7";

	if (data.stage === "COMPLETE") {
		iconName = "check";
		iconColor = "#10B981";
		fillColor = "#10B981";
		badgeBg = isDark ? "rgba(16, 185, 129, 0.2)" : "#DCFCE7";
		badgeText = data.badgeText || "SYNCED";
		badgeTextColor = "#10B981";
	} else if (data.stage === "ERROR" || data.error) {
		iconName = "warning";
		iconColor = "#EF4444";
		fillColor = "#EF4444";
		badgeBg = isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2";
		badgeText = data.badgeText || "FAILED";
		badgeTextColor = "#EF4444";
	} else if (data.stage === "MEDIA") {
		iconColor = "#8B5CF6";
		fillColor = "#8B5CF6";
		badgeBg = isDark ? "rgba(139, 92, 246, 0.2)" : "#F3E8FF";
		badgeText = data.badgeText || "TIER-2 MEDIA";
		badgeTextColor = "#8B5CF6";
	} else if (data.stage === "METADATA") {
		iconColor = "#0284C7";
		fillColor = "#0284C7";
		badgeBg = isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE";
		badgeText = data.badgeText || "TIER-1 DATA";
		badgeTextColor = "#0284C7";
	} else if (data.stage === "RECONCILING") {
		iconColor = "#F59E0B";
		fillColor = "#F59E0B";
		badgeBg = isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7";
		badgeText = data.badgeText || "VLM AUDIT";
		badgeTextColor = "#D97706";
	}

	const barWidth = widthAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["0%", "100%"],
	});

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: colors.backgroundElement,
					borderColor: colors.border,
				},
			]}
		>
			{/* TOP ROW: Icon + Title + Stage Badge + Percent */}
			<View style={styles.headerRow}>
				<View style={styles.leftGroup}>
					<Animated.View
						style={{
							transform: [
								{
									rotate:
										data.stage !== "COMPLETE" && data.stage !== "ERROR"
											? spin
											: "0deg",
								},
							],
						}}
					>
						<AppSymbol name={iconName} size={16} color={iconColor} />
					</Animated.View>
					<Text style={[styles.title, { color: colors.text }]}>
						{data.title}
					</Text>
				</View>

				<View style={styles.rightGroup}>
					<View style={[styles.badge, { backgroundColor: badgeBg }]}>
						<Text style={[styles.badgeLabel, { color: badgeTextColor }]}>
							{badgeText}
						</Text>
					</View>
					<Text style={[styles.percentText, { color: colors.text }]}>
						{percentNumber}%
					</Text>
					{onDismiss &&
					(data.stage === "COMPLETE" || data.stage === "ERROR") ? (
						<Pressable onPress={onDismiss} hitSlop={8} style={styles.closeBtn}>
							<AppSymbol name="close" size={12} color={colors.textSecondary} />
						</Pressable>
					) : null}
				</View>
			</View>

			{/* PROGRESS TRACK */}
			<View
				style={[
					styles.track,
					{ backgroundColor: isDark ? "#334155" : "#E2E8F0" },
				]}
			>
				<Animated.View
					style={[
						styles.fill,
						{
							width: barWidth,
							backgroundColor: fillColor,
						},
					]}
				/>
			</View>

			{/* BOTTOM ROW: Subtitle / Record details */}
			<View style={styles.footerRow}>
				<Text
					style={[styles.subtitle, { color: colors.textSecondary }]}
					numberOfLines={1}
				>
					{data.subtitle}
				</Text>
				{data.detail ? (
					<Text style={[styles.detailText, { color: colors.textSecondary }]}>
						{data.detail}
					</Text>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginHorizontal: 16,
		marginTop: 8,
		marginBottom: 4,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 6,
	},
	leftGroup: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flex: 1,
		marginRight: 8,
	},
	rightGroup: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	title: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 0.6,
		textTransform: "uppercase",
	},
	badge: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
	},
	badgeLabel: {
		fontFamily: Fonts.mono,
		fontSize: 9,
		fontWeight: "700",
		letterSpacing: 0.4,
	},
	percentText: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		minWidth: 32,
		textAlign: "right",
	},
	closeBtn: {
		padding: 2,
		marginLeft: 4,
	},
	track: {
		height: 6,
		borderRadius: 3,
		overflow: "hidden",
		marginVertical: 4,
	},
	fill: {
		height: "100%",
		borderRadius: 3,
	},
	footerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 3,
		gap: 8,
	},
	subtitle: {
		fontSize: 11,
		flex: 1,
	},
	detailText: {
		fontFamily: Fonts.mono,
		fontSize: 10,
		fontWeight: "600",
	},
});
