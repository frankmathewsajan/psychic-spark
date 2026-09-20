import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts, MeterTokens, Spacing } from "@/constants/theme";
import { getDb } from "@/core/db/client";
import { getInspections, getQueueMetrics } from "@/core/db/repository";
import type { InspectionRecord, QueueMetrics } from "@/core/types/inspection";
import { executeTier1Sync } from "@/services/sync/tier1-sync";

export default function DashboardScreen() {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);
	const [metrics, setMetrics] = useState<QueueMetrics>({
		pendingTelemetry: 0,
		syncedTelemetry: 0,
		pendingImages: 0,
	});
	const [history, setHistory] = useState<InspectionRecord[]>([]);

	const loadData = useCallback(async () => {
		const db = await getDb();
		const [m, rows] = await Promise.all([
			getQueueMetrics(db),
			getInspections(db, search),
		]);
		setMetrics(m);
		setHistory(rows);
	}, [search]);

	// Automatically re-query SQLite SSOT whenever screen gains focus
	useFocusEffect(
		useCallback(() => {
			loadData();
		}, [loadData]),
	);

	const handleSync = async () => {
		setRefreshing(true);
		const db = await getDb();
		await executeTier1Sync(db, "https://gateway.example.com");
		await loadData();
		setRefreshing(false);
	};

	return (
		<SafeAreaView style={styles.safeArea} edges={["top"]}>
			{/* 1. SYNC STATUS HUD */}
			<ThemedView type="backgroundElement" style={styles.hudCard}>
				<View style={styles.hudCol}>
					<ThemedText style={styles.hudLabel}>QUEUED OFFLINE</ThemedText>
					<ThemedText style={[styles.hudValue, { color: MeterTokens.warn }]}>
						{metrics.pendingTelemetry}
					</ThemedText>
				</View>
				<View style={styles.divider} />
				<View style={styles.hudCol}>
					<ThemedText style={styles.hudLabel}>TIER-1 SYNCED</ThemedText>
					<ThemedText style={[styles.hudValue, { color: MeterTokens.ok }]}>
						{metrics.syncedTelemetry}
					</ThemedText>
				</View>
				<View style={styles.divider} />
				<View style={styles.hudCol}>
					<ThemedText style={styles.hudLabel}>PHOTOS (WI-FI)</ThemedText>
					<ThemedText style={styles.hudValue}>
						{metrics.pendingImages}
					</ThemedText>
				</View>
			</ThemedView>

			{/* 2. SEARCH & ACTION */}
			<View style={styles.actionRow}>
				<TextInput
					style={styles.input}
					placeholder="SEARCH METER S/N"
					placeholderTextColor="#94A3B8"
					value={search}
					onChangeText={setSearch}
					autoCapitalize="characters"
				/>
				<Pressable
					style={styles.scanBtn}
					onPress={() => router.push("/capture")}
				>
					<ThemedText style={styles.scanBtnText}>+ NEW SCAN</ThemedText>
				</Pressable>
			</View>

			{/* 3. SHIFT HISTORY */}
			<ScrollView
				contentContainerStyle={styles.scrollArea}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={handleSync} />
				}
			>
				<ThemedText style={styles.sectionTitle}>
					SHIFT INSPECTIONS ({history.length})
				</ThemedText>

				{history.length === 0 ? (
					<ThemedView type="backgroundElement" style={styles.emptyContainer}>
						<ThemedText style={styles.emptyText}>
							NO INSPECTIONS COMMITTED TO SQLITE
						</ThemedText>
						<ThemedText style={styles.emptySub}>
							All offline records will appear here after edge validation.
						</ThemedText>
					</ThemedView>
				) : (
					history.map((item) => (
						<ThemedView key={item.id} style={styles.recordCard}>
							<View style={styles.recordHeader}>
								<ThemedText style={styles.recordSn}>
									{item.meter_serial_number}
								</ThemedText>
								<View
									style={[
										styles.qaBadge,
										item.qa_status === "PASS" && { backgroundColor: "#DCFCE7" },
										item.qa_status === "WARNING" && {
											backgroundColor: "#FEF3C7",
										},
										item.qa_status === "CRITICAL_HAZARD" && {
											backgroundColor: "#FEE2E2",
										},
									]}
								>
									<ThemedText style={styles.qaBadgeText}>
										{item.qa_status}
									</ThemedText>
								</View>
							</View>
							<ThemedText style={styles.recordMeta}>
								kWh: {item.extracted_kwh ?? "OVERRIDDEN"} • Conf:{" "}
								{item.ocr_confidence
									? `${(item.ocr_confidence * 100).toFixed(0)}%`
									: "N/A"}
							</ThemedText>
						</ThemedView>
					))
				)}
			</ScrollView>

			{/* 4. FOOTER SYNC TRIGGER */}
			<View style={styles.footerBar}>
				<Pressable style={styles.syncButton} onPress={handleSync}>
					<ThemedText style={styles.syncButtonText}>
						DISPATCH TIER-1 BATCH (CELLULAR)
					</ThemedText>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
	hudCard: {
		flexDirection: "row",
		marginHorizontal: Spacing.md,
		marginTop: Spacing.sm,
		paddingVertical: Spacing.md,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#E2E8F0",
	},
	hudCol: { flex: 1, alignItems: "center" },
	divider: {
		width: 1,
		height: "70%",
		backgroundColor: "#CBD5E1",
		alignSelf: "center",
	},
	hudLabel: {
		fontFamily: Fonts.mono,
		fontSize: 10,
		fontWeight: "700",
		color: "#64748B",
	},
	hudValue: {
		fontFamily: Fonts.mono,
		fontSize: 20,
		fontWeight: "700",
		marginTop: 4,
	},
	actionRow: {
		flexDirection: "row",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.md,
		gap: Spacing.sm,
	},
	input: {
		flex: 1,
		height: 48,
		borderWidth: 1,
		borderColor: "#94A3B8",
		borderRadius: 6,
		paddingHorizontal: Spacing.md,
		fontFamily: Fonts.mono,
		fontSize: 13,
		backgroundColor: "#FFFFFF",
	},
	scanBtn: {
		backgroundColor: MeterTokens.brand,
		height: 48,
		paddingHorizontal: Spacing.md,
		borderRadius: 6,
		justifyContent: "center",
		alignItems: "center",
	},
	scanBtnText: {
		fontFamily: Fonts.mono,
		fontSize: 12,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	scrollArea: {
		paddingHorizontal: Spacing.md,
		paddingBottom: Spacing.xl,
		gap: Spacing.sm,
	},
	sectionTitle: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		color: "#64748B",
	},
	emptyContainer: {
		padding: Spacing.xl,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderStyle: "dashed",
		alignItems: "center",
		gap: 6,
	},
	emptyText: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: "700" },
	emptySub: { fontSize: 12, color: "#64748B", textAlign: "center" },
	recordCard: {
		padding: Spacing.md,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		gap: 4,
	},
	recordHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	recordSn: { fontFamily: Fonts.mono, fontSize: 14, fontWeight: "700" },
	qaBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
	qaBadgeText: {
		fontFamily: Fonts.mono,
		fontSize: 10,
		fontWeight: "700",
		color: "#0F172A",
	},
	recordMeta: { fontFamily: Fonts.mono, fontSize: 12, color: "#64748B" },
	footerBar: {
		padding: Spacing.md,
		borderTopWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
	},
	syncButton: {
		height: 48,
		borderWidth: 1,
		borderColor: "#94A3B8",
		borderRadius: 6,
		justifyContent: "center",
		alignItems: "center",
	},
	syncButtonText: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: "700" },
});
