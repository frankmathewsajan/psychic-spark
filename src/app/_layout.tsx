import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Fonts, MeterTokens } from "@/constants/theme";
import { getDb } from "@/core/db/client";
import { logger } from "@/core/logger";

export default function RootLayout() {
	const [dbReady, setDbReady] = useState(false);

	useEffect(() => {
		getDb()
			.then(() => setDbReady(true))
			.catch((err) =>
				logger.error("AppInit", "Failed opening SQLite database", err),
			);
	}, []);

	if (!dbReady) {
		return (
			<View style={styles.loadingBox}>
				<ActivityIndicator size="small" color={MeterTokens.brand} />
				<Text style={styles.loadingText}>
					INITIALIZING LOCAL SQLITE SSOT...
				</Text>
			</View>
		);
	}

	return (
		<SafeAreaProvider>
			<Stack screenOptions={{ headerShown: false }} />
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	loadingBox: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FFFFFF",
		gap: 12,
	},
	loadingText: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		color: "#64748B",
		letterSpacing: 0.5,
	},
});
