import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
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
	commitReviewedInspection,
	insertInspection,
} from "@/core/db/repository";
import type { QAStatus } from "@/core/types/inspection";

const STATUS_OPTIONS: QAStatus[] = ["PASS", "WARNING", "CRITICAL_HAZARD"];

export default function ValidationScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		sn?: string;
		kwh?: string;
		confidence?: string;
		status?: QAStatus;
		hazard?: string;
		imagePath?: string;
		decimalInferred?: string;
		source?: string;
		inspectionId?: string;
	}>();

	const [serialNumber, setSerialNumber] = useState(params.sn || "");
	const [kwhReading, setKwhReading] = useState(
		params.source === "manual" ? "" : params.kwh || "",
	);
	const [selectedStatus, setSelectedStatus] = useState<QAStatus>(
		(params.status as QAStatus) || "PASS",
	);
	const hazardReason = params.hazard || null;
	const ocrConfidence = params.confidence
		? Number.parseFloat(params.confidence)
		: 0;
	const imageUri = params.imagePath || null;

	const cleanKwh = kwhReading.trim().replace(/\.$/, ".0");
	const numericKwh = Number(cleanKwh);
	const isKwhValid =
		cleanKwh.length > 0 &&
		!Number.isNaN(numericKwh) &&
		Number.isFinite(numericKwh) &&
		numericKwh >= 0;
	const isSnValid = serialNumber.trim().length > 0;
	const isCommitEnabled = isKwhValid && isSnValid;

	const handleCommit = async () => {
		if (!isCommitEnabled) return;

		const db = await getDb();
		const finalKwh = Number.parseFloat(cleanKwh);
		const finalHazard = hazardReason;

		if (params.inspectionId) {
			await commitReviewedInspection(db, params.inspectionId, {
				meterSerialNumber: serialNumber.trim().toUpperCase() || "UNKNOWN",
				extractedKwh: finalKwh,
				ocrConfidence: params.source === "manual" ? 0 : ocrConfidence,
				qaStatus: selectedStatus,
				hazardReason: finalHazard,
			});
		} else {
			await insertInspection(db, {
				id: `ins_${Date.now()}`,
				technician_id: "field_tech",
				device_id: "device_01",
				meter_serial_number: serialNumber.trim().toUpperCase() || "UNKNOWN",
				latitude: 0,
				longitude: 0,
				timestamp_utc: new Date().toISOString(),
				qa_status: selectedStatus,
				hazard_reason: finalHazard,
				extracted_kwh: finalKwh,
				ocr_confidence: params.source === "manual" ? null : ocrConfidence,
				image_local_path: params.imagePath || "",
				inference_status: "DONE",
			});
		}

		router.replace("/");
	};

	return (
		<SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
			<StatusBar style="dark" />
			<KeyboardAvoidingView
				style={styles.keyboardView}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				{/* APP BAR */}
				<View style={styles.topBar}>
					<Pressable style={styles.backBtn} onPress={() => router.back()}>
						<AppSymbol name="back" size={18} color={MD3.color.onSurface} />
						<Text style={styles.backText}>Cancel</Text>
					</Pressable>
					<Text style={styles.appBarTitle}>Edit Inspection</Text>
					<View style={{ width: 60 }} />
				</View>

				<ScrollView contentContainerStyle={styles.content}>
					{/* CAPTURED AUDIT IMAGE PREVIEW */}
					{imageUri ? (
						<View style={styles.imageCard}>
							<Image
								source={{ uri: imageUri }}
								style={styles.previewImage}
								contentFit="cover"
								transition={200}
							/>
						</View>
					) : null}

					{/* STATUS SELECTOR CHIPS */}
					<View style={styles.section}>
						<Text style={styles.label}>Inspection Status</Text>
						<View style={styles.statusChipsRow}>
							{STATUS_OPTIONS.map((status) => {
								const isSelected = selectedStatus === status;
								const isPass = status === "PASS";
								const isWarn = status === "WARNING";
								return (
									<Pressable
										key={status}
										style={[
											styles.selectorChip,
											isPass && isSelected && styles.selectorPass,
											isWarn && isSelected && styles.selectorWarn,
											!isPass && !isWarn && isSelected && styles.selectorCrit,
										]}
										onPress={() => setSelectedStatus(status)}
									>
										<Text
											style={[
												styles.selectorText,
												isSelected && styles.selectorTextSelected,
											]}
										>
											{status}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</View>

					{/* FORM FIELDS */}
					<View style={styles.card}>
						<Text style={styles.label}>Serial Number</Text>
						<TextInput
							style={styles.input}
							value={serialNumber}
							onChangeText={setSerialNumber}
							placeholder="e.g. EB482910"
							placeholderTextColor={MD3.color.outline}
							autoCapitalize="characters"
						/>

						<Text style={[styles.label, { marginTop: 16 }]}>kWh Reading</Text>
						<TextInput
							style={[styles.input, styles.kwhInput]}
							value={kwhReading}
							onChangeText={setKwhReading}
							placeholder="0000.0"
							placeholderTextColor={MD3.color.outline}
							keyboardType="decimal-pad"
						/>
					</View>
				</ScrollView>

				{/* BOTTOM SUBMIT */}
				<View style={styles.bottomBar}>
					<Pressable
						disabled={!isCommitEnabled}
						style={({ pressed }) => [
							styles.commitBtn,
							!isCommitEnabled && styles.commitDisabled,
							pressed && styles.btnPressed,
						]}
						onPress={handleCommit}
					>
						<Text style={styles.commitBtnText}>Save Changes</Text>
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: MD3.color.surface,
	},
	keyboardView: {
		flex: 1,
	},
	topBar: {
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
	appBarTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: MD3.color.onSurface,
	},
	content: {
		padding: 16,
		gap: 16,
	},
	imageCard: {
		width: "100%",
		height: 200,
		borderRadius: MD3.shape.cornerMedium,
		overflow: "hidden",
		backgroundColor: MD3.color.surfaceContainerLow,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
	},
	previewImage: {
		width: "100%",
		height: "100%",
	},
	section: {
		gap: 8,
	},
	statusChipsRow: {
		flexDirection: "row",
		gap: 8,
	},
	selectorChip: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: MD3.shape.cornerFull,
		backgroundColor: MD3.color.surfaceContainerLow,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
		alignItems: "center",
	},
	selectorPass: {
		backgroundColor: MD3.color.successContainer,
		borderColor: MD3.color.success,
	},
	selectorWarn: {
		backgroundColor: MD3.color.warnContainer,
		borderColor: MD3.color.warn,
	},
	selectorCrit: {
		backgroundColor: MD3.color.errorContainer,
		borderColor: MD3.color.error,
	},
	selectorText: {
		fontSize: 11,
		fontWeight: "600",
		color: MD3.color.onSurfaceVariant,
	},
	selectorTextSelected: {
		fontWeight: "700",
		color: MD3.color.onSurface,
	},
	card: {
		backgroundColor: MD3.color.surfaceContainerLowest,
		borderRadius: MD3.shape.cornerMedium,
		padding: 16,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
	},
	label: {
		fontSize: 12,
		fontWeight: "600",
		color: MD3.color.onSurfaceVariant,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 6,
	},
	input: {
		height: 48,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
		borderRadius: MD3.shape.cornerSmall,
		paddingHorizontal: 12,
		fontSize: 16,
		color: MD3.color.onSurface,
		backgroundColor: MD3.color.surfaceContainerLow,
	},
	kwhInput: {
		fontFamily: Fonts.mono,
		fontSize: 22,
		fontWeight: "700",
	},
	bottomBar: {
		padding: 16,
		borderTopWidth: 1,
		borderColor: MD3.color.outlineVariant,
		backgroundColor: MD3.color.surface,
	},
	commitBtn: {
		height: 48,
		backgroundColor: MD3.color.primary,
		borderRadius: MD3.shape.cornerFull,
		justifyContent: "center",
		alignItems: "center",
	},
	commitBtnText: {
		color: MD3.color.onPrimary,
		fontSize: 15,
		fontWeight: "600",
	},
	commitDisabled: {
		opacity: 0.4,
	},
	btnPressed: {
		opacity: 0.85,
	},
});
