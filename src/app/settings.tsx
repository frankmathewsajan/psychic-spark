import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppSymbol } from "@/components/app-symbol";
import { Fonts, MD3 } from "@/constants/theme";
import { getDb } from "@/core/db/client";
import {
	clearAllInspections,
	getSetting,
	setSetting,
} from "@/core/db/repository";

const DEFAULT_GATEWAY_URL = "http://100.108.9.95:8000";

export default function SettingsScreen() {
	const router = useRouter();
	const [clearing, setClearing] = useState(false);
	const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
	const [urlSavedFeedback, setUrlSavedFeedback] = useState<string | null>(null);
	const [isWaking, setIsWaking] = useState(false);
	const [wakeFeedback, setWakeFeedback] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		(async () => {
			try {
				const db = await getDb();
				const saved = await getSetting(db, "gateway_url", DEFAULT_GATEWAY_URL);
				if (isMounted) setGatewayUrl(saved);
			} catch {}
		})();
		return () => {
			isMounted = false;
		};
	}, []);

	const handleSaveGateway = async () => {
		const trimmed = gatewayUrl.trim().replace(/\/+$/, "");
		if (!trimmed) {
			Alert.alert("Invalid URL", "Please enter a valid URL.");
			return;
		}
		try {
			const db = await getDb();
			await setSetting(db, "gateway_url", trimmed);
			setGatewayUrl(trimmed);
			setUrlSavedFeedback("Saved ✓");
			setTimeout(() => setUrlSavedFeedback(null), 2500);
		} catch {
			Alert.alert("Error", "Failed to save Gateway URL.");
		}
	};

	const handleWakeServer = async () => {
		if (isWaking) return;
		setIsWaking(true);
		setWakeFeedback("Waking server (may take ~45s)...");

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 60000);

		try {
			const res = await fetch(
				`${gatewayUrl.trim().replace(/\/+$/, "")}/api/v1/health`,
				{
					method: "GET",
					signal: controller.signal,
				},
			);
			clearTimeout(timeoutId);
			if (res.ok) {
				setWakeFeedback("Server Online ✓");
			} else {
				setWakeFeedback(`HTTP ${res.status}`);
			}
		} catch {
			clearTimeout(timeoutId);
			setWakeFeedback("Unreachable");
		} finally {
			setIsWaking(false);
			setTimeout(() => setWakeFeedback(null), 4000);
		}
	};

	const handleClearAll = () => {
		Alert.alert(
			"Clear All Data?",
			"This will delete all local inspection history, pending uploads, and review items from this device.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete Everything",
					style: "destructive",
					onPress: async () => {
						try {
							setClearing(true);
							const db = await getDb();
							await clearAllInspections(db);
							Alert.alert("Cleared", "All inspections have been removed.");
							router.replace("/");
						} catch {
							Alert.alert("Error", "Failed to clear database.");
						} finally {
							setClearing(false);
						}
					},
				},
			],
		);
	};

	return (
		<SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
			<StatusBar style="dark" />

			{/* HEADER */}
			<View style={styles.header}>
				<Pressable style={styles.backBtn} onPress={() => router.back()}>
					<AppSymbol name="back" size={20} color={MD3.color.onSurface} />
					<Text style={styles.backText}>Back</Text>
				</Pressable>
				<Text style={styles.title}>Settings</Text>
				<View style={{ width: 60 }} />
			</View>

			<View style={styles.content}>
				{/* CLOUD GATEWAY CONFIG */}
				<Text style={styles.sectionTitle}>Cloud Gateway</Text>
				<View style={styles.card}>
					<View style={styles.cardInfo}>
						<Text style={styles.cardItemTitle}>Backend Gateway URL</Text>
						<Text style={styles.cardItemSub}>
							Target FastAPI server or Render instance
						</Text>
					</View>

					{/* QUICK PRESET SELECTOR (IPv4 / IPv6 / CLOUD) */}
					<View style={styles.presetsRow}>
						<Pressable
							style={[
								styles.presetChip,
								gatewayUrl === "http://100.108.9.95:8000" &&
									styles.presetChipActive,
							]}
							onPress={() => setGatewayUrl("http://100.108.9.95:8000")}
						>
							<Text
								style={[
									styles.presetText,
									gatewayUrl === "http://100.108.9.95:8000" &&
										styles.presetTextActive,
								]}
							>
								Tailscale (IPv4)
							</Text>
						</Pressable>

						<Pressable
							style={[
								styles.presetChip,
								gatewayUrl.includes("onrender.com") && styles.presetChipActive,
							]}
							onPress={() =>
								setGatewayUrl("https://psychic-spark.onrender.com")
							}
						>
							<Text
								style={[
									styles.presetText,
									gatewayUrl.includes("onrender.com") &&
										styles.presetTextActive,
								]}
							>
								Render (Cloud)
							</Text>
						</Pressable>

						<Pressable
							style={[
								styles.presetChip,
								gatewayUrl === "http://10.0.2.2:8000" &&
									styles.presetChipActive,
							]}
							onPress={() => setGatewayUrl("http://10.0.2.2:8000")}
						>
							<Text
								style={[
									styles.presetText,
									gatewayUrl === "http://10.0.2.2:8000" &&
										styles.presetTextActive,
								]}
							>
								Emulator
							</Text>
						</Pressable>
					</View>

					<TextInput
						style={styles.input}
						value={gatewayUrl}
						onChangeText={setGatewayUrl}
						placeholder="http://100.108.9.95:8000 or https://..."
						placeholderTextColor={MD3.color.outline}
						autoCapitalize="none"
						autoCorrect={false}
					/>

					<View style={styles.rowActions}>
						<Pressable
							style={({ pressed }) => [
								styles.primaryBtn,
								pressed && styles.btnPressed,
							]}
							onPress={handleSaveGateway}
						>
							<Text style={styles.primaryBtnText}>
								{urlSavedFeedback ?? "Save URL"}
							</Text>
						</Pressable>

						<Pressable
							disabled={isWaking}
							style={({ pressed }) => [
								styles.secondaryBtn,
								pressed && styles.btnPressed,
								isWaking && styles.btnDisabled,
							]}
							onPress={handleWakeServer}
						>
							{isWaking ? (
								<ActivityIndicator size="small" color={MD3.color.primary} />
							) : (
								<Text style={styles.secondaryBtnText}>Wake Server</Text>
							)}
						</Pressable>
					</View>

					{wakeFeedback ? (
						<View style={styles.feedbackBar}>
							<Text style={styles.feedbackText}>{wakeFeedback}</Text>
						</View>
					) : null}
				</View>

				{/* DATA STORAGE SECTION */}
				<Text style={styles.sectionTitle}>Local Storage</Text>
				<View style={styles.card}>
					<View style={styles.cardRow}>
						<View style={styles.cardInfo}>
							<Text style={styles.cardItemTitle}>Clear Local Database</Text>
							<Text style={styles.cardItemSub}>
								Wipe offline queue, history records, and review items
							</Text>
						</View>
					</View>

					<Pressable
						disabled={clearing}
						style={({ pressed }) => [
							styles.dangerBtn,
							pressed && styles.btnPressed,
							clearing && styles.btnDisabled,
						]}
						onPress={handleClearAll}
					>
						{clearing ? (
							<ActivityIndicator size="small" color={MD3.color.error} />
						) : (
							<>
								<AppSymbol name="trash" size={16} color={MD3.color.error} />
								<Text style={styles.dangerBtnText}>Clear All Data</Text>
							</>
						)}
					</Pressable>
				</View>

				{/* ABOUT SECTION */}
				<Text style={styles.sectionTitle}>App Info</Text>
				<View style={styles.card}>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Engine</Text>
						<Text style={styles.infoValue}>MobileNetV3 + ML Kit</Text>
					</View>
					<View style={styles.divider} />
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Database</Text>
						<Text style={styles.infoValue}>SQLite SSOT (WAL)</Text>
					</View>
					<View style={styles.divider} />
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Backend</Text>
						<Text style={styles.infoValue}>FastAPI + Supabase</Text>
					</View>
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: MD3.color.surface,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderColor: MD3.color.outlineVariant,
	},
	backBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		width: 60,
	},
	backText: {
		fontSize: 14,
		color: MD3.color.onSurface,
		fontWeight: "500",
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
		color: MD3.color.onSurface,
	},
	content: {
		padding: 16,
		gap: 16,
	},
	sectionTitle: {
		fontSize: 12,
		fontWeight: "600",
		color: MD3.color.onSurfaceVariant,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginLeft: 4,
	},
	card: {
		backgroundColor: MD3.color.surfaceContainerLowest,
		borderRadius: MD3.shape.cornerMedium,
		padding: 16,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
		gap: 12,
	},
	cardRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	cardInfo: {
		flex: 1,
		gap: 2,
	},
	cardItemTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: MD3.color.onSurface,
	},
	cardItemSub: {
		fontSize: 12,
		color: MD3.color.onSurfaceVariant,
	},
	presetsRow: {
		flexDirection: "row",
		gap: 8,
	},
	presetChip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: MD3.shape.cornerFull,
		backgroundColor: MD3.color.surfaceContainerLow,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
	},
	presetChipActive: {
		backgroundColor: MD3.color.primaryContainer,
		borderColor: MD3.color.primary,
	},
	presetText: {
		fontSize: 11,
		fontWeight: "600",
		color: MD3.color.onSurfaceVariant,
	},
	presetTextActive: {
		color: MD3.color.onPrimaryContainer,
	},
	input: {
		height: 44,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
		borderRadius: MD3.shape.cornerSmall,
		paddingHorizontal: 12,
		fontSize: 13,
		fontFamily: Fonts.mono,
		color: MD3.color.onSurface,
		backgroundColor: MD3.color.surface,
	},
	rowActions: {
		flexDirection: "row",
		gap: 8,
	},
	primaryBtn: {
		flex: 1,
		height: 40,
		backgroundColor: MD3.color.primary,
		borderRadius: MD3.shape.cornerFull,
		justifyContent: "center",
		alignItems: "center",
	},
	primaryBtnText: {
		color: MD3.color.onPrimary,
		fontSize: 13,
		fontWeight: "600",
	},
	secondaryBtn: {
		flex: 1,
		height: 40,
		backgroundColor: MD3.color.surfaceContainerLow,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
		borderRadius: MD3.shape.cornerFull,
		justifyContent: "center",
		alignItems: "center",
	},
	secondaryBtnText: {
		color: MD3.color.primary,
		fontSize: 13,
		fontWeight: "600",
	},
	feedbackBar: {
		backgroundColor: MD3.color.surfaceContainerHigh,
		borderRadius: MD3.shape.cornerSmall,
		paddingVertical: 6,
		paddingHorizontal: 10,
		alignItems: "center",
	},
	feedbackText: {
		fontSize: 12,
		fontWeight: "500",
		color: MD3.color.primary,
		fontFamily: Fonts.mono,
	},
	dangerBtn: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
		backgroundColor: MD3.color.errorContainer,
		borderRadius: MD3.shape.cornerFull,
		height: 44,
		marginTop: 4,
	},
	dangerBtnText: {
		fontSize: 14,
		fontWeight: "600",
		color: MD3.color.error,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	infoLabel: {
		fontSize: 14,
		color: MD3.color.onSurfaceVariant,
	},
	infoValue: {
		fontSize: 14,
		fontWeight: "500",
		color: MD3.color.onSurface,
		fontFamily: Fonts.mono,
	},
	divider: {
		height: 1,
		backgroundColor: MD3.color.outlineVariant,
	},
	btnPressed: {
		opacity: 0.85,
	},
	btnDisabled: {
		opacity: 0.5,
	},
});
