import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
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
	getHardwareFingerprint,
	getOrCreateDeviceId,
	getSetting,
	setSetting,
} from "@/core/db/repository";
import { type ThemeMode, useTheme } from "@/core/theme-context";

const DEFAULT_GATEWAY_URL = "http://100.108.9.95:8000";

export default function SettingsScreen() {
	const router = useRouter();
	const { themeMode, isDark, colors, setThemeMode } = useTheme();
	const [clearing, setClearing] = useState(false);
	const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
	const [urlSavedFeedback, setUrlSavedFeedback] = useState<string | null>(null);
	const [isWaking, setIsWaking] = useState(false);
	const [wakeFeedback, setWakeFeedback] = useState<string | null>(null);
	const [deviceId, setDeviceId] = useState<string>("Loading...");
	const [fingerprintHash, setFingerprintHash] = useState<string>("");

	useEffect(() => {
		let isMounted = true;
		(async () => {
			try {
				const db = await getDb();
				const saved = await getSetting(db, "gateway_url", DEFAULT_GATEWAY_URL);
				const id = await getOrCreateDeviceId(db);
				const fp = getHardwareFingerprint();
				if (isMounted) {
					setGatewayUrl(saved);
					setDeviceId(id);
					setFingerprintHash(fp.fingerprintHash);
				}
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

	const dynBg = { backgroundColor: colors.background };
	const dynCard = {
		backgroundColor: colors.backgroundElement,
		borderColor: colors.border,
	};
	const dynText = { color: colors.text };
	const dynSub = { color: colors.textSecondary };

	return (
		<SafeAreaView style={[styles.screen, dynBg]} edges={["top", "bottom"]}>
			<StatusBar style={isDark ? "light" : "dark"} />

			{/* HEADER */}
			<View style={[styles.header, { borderColor: colors.border }]}>
				<Pressable style={styles.backBtn} onPress={() => router.back()}>
					<AppSymbol name="back" size={20} color={colors.text} />
					<Text style={[styles.backText, dynText]}>Back</Text>
				</Pressable>
				<Text style={[styles.title, dynText]}>Settings</Text>
				<View style={{ width: 60 }} />
			</View>

			<ScrollView
				style={styles.contentScroll}
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* THEME & APPEARANCE */}
				<Text style={[styles.sectionTitle, dynSub]}>Appearance</Text>
				<View style={[styles.card, dynCard]}>
					<View style={styles.cardInfo}>
						<Text style={[styles.cardItemTitle, dynText]}>Theme Mode</Text>
						<Text style={[styles.cardItemSub, dynSub]}>
							Switch between Dark Mode, Light Mode, or follow Device System
						</Text>
					</View>

					<View style={styles.presetsRow}>
						{(["system", "dark", "light"] as ThemeMode[]).map((mode) => (
							<Pressable
								key={mode}
								style={[
									styles.presetChip,
									{
										borderColor: colors.border,
										backgroundColor: colors.background,
									},
									themeMode === mode && styles.presetChipActive,
								]}
								onPress={() => setThemeMode(mode)}
							>
								<Text
									style={[
										styles.presetText,
										dynSub,
										themeMode === mode && styles.presetTextActive,
									]}
								>
									{mode.toUpperCase()}
								</Text>
							</Pressable>
						))}
					</View>
				</View>

				{/* CLOUD GATEWAY CONFIG */}
				<Text style={[styles.sectionTitle, dynSub]}>Cloud Gateway</Text>
				<View style={[styles.card, dynCard]}>
					<View style={styles.cardInfo}>
						<Text style={[styles.cardItemTitle, dynText]}>
							Backend Gateway URL
						</Text>
						<Text style={[styles.cardItemSub, dynSub]}>
							Target FastAPI server or Render instance
						</Text>
					</View>

					<View style={styles.presetsRow}>
						<Pressable
							style={[
								styles.presetChip,
								{
									borderColor: colors.border,
									backgroundColor: colors.background,
								},
								gatewayUrl === "http://100.108.9.95:8000" &&
									styles.presetChipActive,
							]}
							onPress={() => setGatewayUrl("http://100.108.9.95:8000")}
						>
							<Text
								style={[
									styles.presetText,
									dynSub,
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
								{
									borderColor: colors.border,
									backgroundColor: colors.background,
								},
								gatewayUrl.includes("onrender.com") && styles.presetChipActive,
							]}
							onPress={() =>
								setGatewayUrl("https://psychic-spark.onrender.com")
							}
						>
							<Text
								style={[
									styles.presetText,
									dynSub,
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
								{
									borderColor: colors.border,
									backgroundColor: colors.background,
								},
								gatewayUrl === "http://10.0.2.2:8000" &&
									styles.presetChipActive,
							]}
							onPress={() => setGatewayUrl("http://10.0.2.2:8000")}
						>
							<Text
								style={[
									styles.presetText,
									dynSub,
									gatewayUrl === "http://10.0.2.2:8000" &&
										styles.presetTextActive,
								]}
							>
								Emulator
							</Text>
						</Pressable>
					</View>

					<TextInput
						style={[
							styles.input,
							{
								borderColor: colors.border,
								backgroundColor: colors.background,
								color: colors.text,
							},
						]}
						value={gatewayUrl}
						onChangeText={setGatewayUrl}
						placeholder="http://100.108.9.95:8000 or https://..."
						placeholderTextColor={colors.textSecondary}
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
								{
									borderColor: colors.border,
									backgroundColor: colors.background,
								},
								pressed && styles.btnPressed,
								isWaking && styles.btnDisabled,
							]}
							onPress={handleWakeServer}
						>
							{isWaking ? (
								<ActivityIndicator size="small" color={MD3.color.primary} />
							) : (
								<Text style={[styles.secondaryBtnText, { color: colors.text }]}>
									Wake Server
								</Text>
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
				<Text style={[styles.sectionTitle, dynSub]}>Local Storage</Text>
				<View style={[styles.card, dynCard]}>
					<View style={styles.cardRow}>
						<View style={styles.cardInfo}>
							<Text style={[styles.cardItemTitle, dynText]}>
								Clear Local Database
							</Text>
							<Text style={[styles.cardItemSub, dynSub]}>
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

				{/* ABOUT & HARDWARE IDENTITY */}
				<Text style={[styles.sectionTitle, dynSub]}>Hardware Identity</Text>
				<View style={[styles.card, dynCard]}>
					<View style={styles.infoRow}>
						<Text style={[styles.infoLabel, dynSub]}>Device ID</Text>
						<Text style={[styles.infoValue, dynText, styles.mono]}>
							{deviceId}
						</Text>
					</View>
					<View style={[styles.divider, { backgroundColor: colors.border }]} />
					<View style={styles.infoRow}>
						<Text style={[styles.infoLabel, dynSub]}>Hardware SHA-256</Text>
						<Text
							style={[styles.infoValue, dynSub, styles.mono, { fontSize: 10 }]}
						>
							{fingerprintHash ? `${fingerprintHash.substring(0, 16)}...` : "—"}
						</Text>
					</View>
					<View style={[styles.divider, { backgroundColor: colors.border }]} />
					<View style={styles.infoRow}>
						<Text style={[styles.infoLabel, dynSub]}>Engine</Text>
						<Text style={[styles.infoValue, dynText]}>
							MobileNetV3 + ML Kit
						</Text>
					</View>
					<View style={[styles.divider, { backgroundColor: colors.border }]} />
					<View style={styles.infoRow}>
						<Text style={[styles.infoLabel, dynSub]}>Database</Text>
						<Text style={[styles.infoValue, dynText]}>SQLite SSOT (WAL)</Text>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	backBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		width: 60,
	},
	backText: {
		fontSize: 14,
		fontWeight: "500",
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
	},
	contentScroll: {
		flex: 1,
	},
	scrollContent: {
		padding: 16,
		paddingBottom: 40,
		gap: 16,
	},
	sectionTitle: {
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginLeft: 4,
	},
	card: {
		borderRadius: MD3.shape.cornerMedium,
		borderWidth: 1,
		padding: 16,
		gap: 12,
	},
	cardRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	cardInfo: {
		gap: 2,
	},
	cardItemTitle: {
		fontSize: 15,
		fontWeight: "600",
	},
	cardItemSub: {
		fontSize: 12,
	},
	presetsRow: {
		flexDirection: "row",
		gap: 8,
		flexWrap: "wrap",
	},
	presetChip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: MD3.shape.cornerFull,
		borderWidth: 1,
	},
	presetChipActive: {
		backgroundColor: "#0061A4",
		borderColor: "#0061A4",
	},
	presetText: {
		fontSize: 11,
		fontWeight: "600",
	},
	presetTextActive: {
		color: "#FFFFFF",
	},
	input: {
		height: 44,
		borderWidth: 1,
		borderRadius: MD3.shape.cornerSmall,
		paddingHorizontal: 12,
		fontSize: 13,
		fontFamily: Fonts.mono,
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
		color: "#FFFFFF",
		fontSize: 13,
		fontWeight: "600",
	},
	secondaryBtn: {
		flex: 1,
		height: 40,
		borderWidth: 1,
		borderRadius: MD3.shape.cornerFull,
		justifyContent: "center",
		alignItems: "center",
	},
	secondaryBtnText: {
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
		fontSize: 13,
	},
	infoValue: {
		fontSize: 13,
		fontWeight: "600",
	},
	mono: {
		fontFamily: Fonts.mono,
	},
	divider: {
		height: 1,
	},
	btnPressed: {
		opacity: 0.8,
	},
	btnDisabled: {
		opacity: 0.5,
	},
});
