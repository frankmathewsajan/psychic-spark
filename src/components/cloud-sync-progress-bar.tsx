import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
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
	progress: number;
	title: string;
	message: string;
	error?: boolean;
}

export function CloudSyncProgressBar({ data }: { data: SyncProgressData }) {
	const { colors, isDark } = useTheme();
	const widthAnim = useRef(new Animated.Value(0)).current;
	const spinAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(widthAnim, {
			toValue: Math.max(0, Math.min(1, data.progress)),
			duration: 250,
			easing: Easing.out(Easing.quad),
			useNativeDriver: false,
		}).start();
	}, [data.progress, widthAnim]);

	useEffect(() => {
		if (data.active && data.stage !== "COMPLETE" && data.stage !== "ERROR") {
			const loop = Animated.loop(
				Animated.timing(spinAnim, {
					toValue: 1,
					duration: 1000,
					easing: Easing.linear,
					useNativeDriver: true,
				}),
			);
			loop.start();
			return () => loop.stop();
		}
		spinAnim.setValue(0);
	}, [data.active, data.stage, spinAnim]);

	if (!data.active && data.stage === "IDLE") return null;

	const spin = spinAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "360deg"],
	});

	const isComplete = data.stage === "COMPLETE";
	const isError = data.stage === "ERROR" || !!data.error;
	const icon = isComplete ? "check" : isError ? "warning" : "sync";
	const accent = isComplete
		? "#10B981"
		: isError
			? "#EF4444"
			: data.stage === "MEDIA"
				? "#8B5CF6"
				: MD3.color.primary;

	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.backgroundElement,
					borderColor: colors.border,
				},
			]}
		>
			<View style={styles.header}>
				<View style={styles.left}>
					<Animated.View
						style={{
							transform: [{ rotate: !isComplete && !isError ? spin : "0deg" }],
						}}
					>
						<AppSymbol name={icon} size={15} color={accent} />
					</Animated.View>
					<Text style={[styles.title, { color: colors.text }]}>
						{data.title}
					</Text>
				</View>
				<Text style={[styles.percent, { color: accent }]}>
					{Math.round(Math.max(0, Math.min(1, data.progress)) * 100)}%
				</Text>
			</View>

			<View
				style={[
					styles.track,
					{ backgroundColor: isDark ? "#334155" : "#E2E8F0" },
				]}
			>
				<Animated.View
					style={[
						styles.bar,
						{
							width: widthAnim.interpolate({
								inputRange: [0, 1],
								outputRange: ["0%", "100%"],
							}),
							backgroundColor: accent,
						},
					]}
				/>
			</View>

			<Text
				style={[styles.message, { color: colors.textSecondary }]}
				numberOfLines={1}
			>
				{data.message}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		marginHorizontal: 16,
		marginTop: 8,
		marginBottom: 4,
		paddingHorizontal: 12,
		paddingVertical: 9,
		borderRadius: 8,
		borderWidth: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 6,
	},
	left: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	title: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 0.5,
	},
	percent: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
	},
	track: {
		height: 5,
		borderRadius: 3,
		overflow: "hidden",
		marginBottom: 5,
	},
	bar: {
		height: "100%",
		borderRadius: 3,
	},
	message: {
		fontSize: 11,
	},
});
