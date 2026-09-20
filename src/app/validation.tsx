import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
	Pressable,
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
import { insertInspection } from "@/core/db/repository";
import type { QAStatus } from "@/core/types/inspection";

export default function ValidationScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		sn?: string;
		kwh?: string;
		confidence?: string;
		status?: QAStatus;
		hazard?: string;
		imagePath?: string;
	}>();

	const [serialNumber, setSerialNumber] = useState(params.sn || "EB4820194");
	const [kwhReading, setKwhReading] = useState(params.kwh || "1428.5");
	const qaStatus: QAStatus = (params.status as QAStatus) || "PASS";
	const hazardReason = params.hazard || null;
	const ocrConfidence = params.confidence
		? Number.parseFloat(params.confidence)
		: 0.962;

	const isLockout = qaStatus === "CRITICAL_HAZARD";

	const handleCommit = async () => {
		if (isLockout) return;

		const db = await getDb();
		await insertInspection(db, {
			id: `ins_${Date.now()}`,
			technician_id: "TECH_MH_4021",
			device_id: "DEV_PIXEL_8842",
			meter_serial_number: serialNumber,
			latitude: 19.076,
			longitude: 72.8777,
			timestamp_utc: new Date().toISOString(),
			qa_status: qaStatus,
			hazard_reason: hazardReason,
			extracted_kwh: Number.parseFloat(kwhReading) || null,
			ocr_confidence: ocrConfidence,
			image_local_path:
				params.imagePath || "/data/user/0/com.novo/files/raw.jpg",
		});

		router.replace("/");
	};

	return (
		<SafeAreaView style={styles.safeArea} edges={["top"]}>
			{/* 1. STATUS BANNER */}
			<View
				style={[
					styles.statusBar,
					qaStatus === "PASS" && { backgroundColor: MeterTokens.ok },
					qaStatus === "WARNING" && { backgroundColor: MeterTokens.warn },
					qaStatus === "CRITICAL_HAZARD" && {
						backgroundColor: MeterTokens.crit,
					},
				]}
			>
				<ThemedText style={styles.statusTitle}>
					QA VERDICT: {qaStatus}
				</ThemedText>
				{hazardReason ? (
					<ThemedText style={styles.statusSub}>{hazardReason}</ThemedText>
				) : null}
			</View>

			<ScrollView contentContainerStyle={styles.container}>
				<ThemedText style={styles.sectionHeader}>
					EDGE INFERENCE READOUT
				</ThemedText>
				<ThemedView type="backgroundElement" style={styles.readoutCard}>
					<View style={styles.row}>
						<View style={styles.col}>
							<ThemedText style={styles.fieldLabel}>METER SERIAL NO</ThemedText>
							<TextInput
								style={styles.monoInput}
								value={serialNumber}
								onChangeText={setSerialNumber}
							/>
						</View>
						<View style={[styles.col, styles.borderLeft]}>
							<ThemedText style={styles.fieldLabel}>OCR CONFIDENCE</ThemedText>
							<ThemedText style={styles.confValue}>
								{(ocrConfidence * 100).toFixed(1)}%
							</ThemedText>
						</View>
					</View>

					<View style={styles.kwhBox}>
						<ThemedText style={styles.fieldLabel}>
							7-SEGMENT kWh (MANUAL OVERRIDE)
						</ThemedText>
						<TextInput
							style={styles.kwhInput}
							value={kwhReading}
							onChangeText={setKwhReading}
							keyboardType="numeric"
						/>
					</View>
				</ThemedView>

				{isLockout && (
					<View style={styles.lockoutCard}>
						<ThemedText style={styles.lockoutTitle}>
							SAFETY LOCKOUT ENFORCED
						</ThemedText>
						<ThemedText style={styles.lockoutBody}>
							Terminal defects cause &gt;30% of field burnouts. Rectify loose
							conductors or re-seat the cover, then re-inspect to proceed.
						</ThemedText>
						<Pressable
							style={styles.reinspectBtn}
							onPress={() => router.back()}
						>
							<ThemedText style={styles.reinspectBtnText}>
								RE-TAKE INSPECTION
							</ThemedText>
						</Pressable>
					</View>
				)}
			</ScrollView>

			{/* 2. FOOTER */}
			<View style={styles.footerBar}>
				<Pressable
					disabled={isLockout}
					style={[styles.commitBtn, isLockout && styles.commitBtnDisabled]}
					onPress={handleCommit}
				>
					<ThemedText style={styles.commitBtnText}>
						{isLockout
							? "LOCKOUT ACTIVE: RESOLVE DEFECT"
							: "COMMIT RECORD TO LOCAL SQLITE SSOT →"}
					</ThemedText>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
	statusBar: { padding: Spacing.md, alignItems: "center" },
	statusTitle: {
		fontFamily: Fonts.mono,
		fontSize: 13,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	statusSub: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		color: "#FFFFFF",
		marginTop: 4,
	},
	container: { padding: Spacing.md, gap: Spacing.md },
	sectionHeader: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		color: "#64748B",
	},
	readoutCard: {
		padding: Spacing.md,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		gap: Spacing.md,
	},
	row: { flexDirection: "row" },
	col: { flex: 1, gap: 4 },
	borderLeft: {
		paddingLeft: Spacing.md,
		borderLeftWidth: 1,
		borderColor: "#CBD5E1",
	},
	fieldLabel: {
		fontFamily: Fonts.mono,
		fontSize: 10,
		fontWeight: "700",
		color: "#64748B",
	},
	confValue: {
		fontFamily: Fonts.mono,
		fontSize: 16,
		fontWeight: "700",
		color: MeterTokens.ok,
	},
	monoInput: {
		fontFamily: Fonts.mono,
		fontSize: 14,
		fontWeight: "700",
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#94A3B8",
		borderRadius: 4,
		paddingHorizontal: 8,
		height: 38,
	},
	kwhBox: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 4,
		padding: Spacing.md,
	},
	kwhInput: {
		fontFamily: Fonts.mono,
		fontSize: 28,
		fontWeight: "700",
		color: "#0F172A",
	},
	lockoutCard: {
		backgroundColor: "#FEF2F2",
		borderWidth: 1,
		borderColor: MeterTokens.crit,
		borderRadius: 6,
		padding: Spacing.md,
		gap: 8,
	},
	lockoutTitle: {
		fontFamily: Fonts.mono,
		fontSize: 12,
		fontWeight: "700",
		color: MeterTokens.crit,
	},
	lockoutBody: { fontSize: 12, color: "#0F172A", lineHeight: 18 },
	reinspectBtn: {
		backgroundColor: MeterTokens.crit,
		height: 48,
		borderRadius: 6,
		justifyContent: "center",
		alignItems: "center",
	},
	reinspectBtnText: {
		fontFamily: Fonts.mono,
		fontSize: 11,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	footerBar: {
		padding: Spacing.md,
		borderTopWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
	},
	commitBtn: {
		height: 52,
		backgroundColor: MeterTokens.brand,
		borderRadius: 6,
		justifyContent: "center",
		alignItems: "center",
	},
	commitBtnDisabled: { backgroundColor: "#94A3B8" },
	commitBtnText: {
		fontFamily: Fonts.mono,
		fontSize: 12,
		fontWeight: "700",
		color: "#FFFFFF",
	},
});
