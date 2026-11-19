import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
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
import { CamScannerCropperModal } from "@/components/camscanner-cropper-modal";
import { Fonts, MD3 } from "@/constants/theme";
import { getDb } from "@/core/db/client";
import { insertInspection } from "@/core/db/repository";
import { getCachedCoordinates, getCurrentCoordinates } from "@/core/location";
import { logger } from "@/core/logger";
import {
	type CroppedLcdOcrResult,
	cropLcdReticle,
	runCroppedLcdOcr,
	runWireSafetyCheck,
	type WireSafetyResult,
} from "@/services/inference/meter-inference";

type StepStatus = "cropping" | "safety" | "ocr" | "ready";

export default function InspectPreviewScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		photoUri: string;
		photoWidth?: string;
		photoHeight?: string;
		tilt?: string;
		barcode?: string;
		cropBoundsJson?: string;
		latitude?: string;
		longitude?: string;
	}>();

	const photoUri = params.photoUri;
	const tiltDeg = params.tilt ? Number.parseFloat(params.tilt) : 0;
	const initialBarcode = params.barcode?.trim() || "";

	const [statusStage, setStatusStage] = useState<StepStatus>("cropping");
	const [statusText, setStatusText] = useState("Aligning LCD crop...");
	const [croppedUri, setCroppedUri] = useState<string | null>(null);

	const [safetyResult, setSafetyResult] = useState<WireSafetyResult | null>(
		null,
	);
	const [ocrResult, setOcrResult] = useState<CroppedLcdOcrResult | null>(null);

	const [kwhInput, setKwhInput] = useState("");
	const [serialInput, setSerialInput] = useState(initialBarcode);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isCropperVisible, setIsCropperVisible] = useState(false);
	const [currentCropBounds, setCurrentCropBounds] = useState<
		[number, number, number, number]
	>(() => {
		if (params.cropBoundsJson) {
			try {
				const parsed = JSON.parse(params.cropBoundsJson);
				if (Array.isArray(parsed) && parsed.length === 4) {
					return parsed as [number, number, number, number];
				}
			} catch {}
		}
		return [0.18, 0.28, 0.64, 0.22];
	});

	const isInitialized = useRef(false);

	const handleManualCropConfirm = async (
		bounds: [number, number, number, number],
	) => {
		try {
			setCurrentCropBounds(bounds);
			setStatusStage("cropping");
			setStatusText("Applying clean LCD crop...");
			const newCropped = await cropLcdReticle(photoUri, bounds);
			setCroppedUri(newCropped);

			// Re-run OCR on clean crop
			setStatusStage("ocr");
			setStatusText("Re-reading clean LCD crop...");
			const ocr = await runCroppedLcdOcr(newCropped);
			setOcrResult(ocr);
			if (ocr.kwh !== null) {
				setKwhInput(String(ocr.kwh));
			}
			setStatusStage("ready");
			setStatusText("Verification complete");
		} catch (err) {
			logger.error("InspectPreview", "Failed applying manual crop", err);
			setStatusStage("ready");
		}
	};

	useEffect(() => {
		if (isInitialized.current || !photoUri) return;
		isInitialized.current = true;

		async function runPipeline() {
			try {
				// Parse crop bounds if available
				let reticleBounds: [number, number, number, number] | undefined;
				if (params.cropBoundsJson) {
					try {
						const parsed = JSON.parse(params.cropBoundsJson);
						if (Array.isArray(parsed) && parsed.length === 4) {
							reticleBounds = parsed as [number, number, number, number];
						}
					} catch (e) {
						logger.warn("InspectPreview", "Failed parsing cropBoundsJson", e);
					}
				}

				// 1. Crop LCD Reticle
				setStatusStage("cropping");
				setStatusText("Extracting LCD display crop...");
				const cropped = await cropLcdReticle(photoUri, reticleBounds);
				setCroppedUri(cropped);

				// 2. Wire Safety Check (TFLite MobileNetV3)
				setStatusStage("safety");
				setStatusText("Checking wire safety & cover integrity...");
				const safety = await runWireSafetyCheck(photoUri);
				setSafetyResult(safety);

				// 3. Cropped LCD OCR (ML Kit)
				setStatusStage("ocr");
				setStatusText("Reading cropped LCD display...");
				const ocr = await runCroppedLcdOcr(cropped);
				setOcrResult(ocr);

				// Auto-fill kWh if detected
				if (ocr.kwh !== null) {
					setKwhInput(String(ocr.kwh));
				}

				// If no barcode was provided, generate or derive default serial
				if (!initialBarcode) {
					const suffix =
						ocr.kwh !== null
							? String(ocr.kwh).replace(/\D/g, "").slice(-6)
							: `${(Date.now() % 900000) + 100000}`;
					setSerialInput(`EB${suffix}`);
				}

				setStatusStage("ready");
				setStatusText("Verification complete");
			} catch (err) {
				logger.error("InspectPreview", "Pipeline execution error", err);
				setStatusStage("ready");
				setStatusText("Verification finished with warnings");
			}
		}

		runPipeline();
	}, [photoUri, params.cropBoundsJson, initialBarcode]);

	const isHazard = safetyResult?.isHazard ?? false;
	const isProcessing = statusStage !== "ready";

	// Save helper
	const handleSave = async (forceCriticalHazard = false) => {
		if (isSubmitting || !photoUri) return;
		setIsSubmitting(true);

		try {
			const id = `insp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
			let persistentPath = photoUri;

			try {
				const capturesDir = new Directory(Paths.document, "captures");
				if (!capturesDir.exists) capturesDir.create();
				const destFile = new File(capturesDir, `${id}.jpg`);
				const sourceFile = new File(photoUri);
				await sourceFile.copy(destFile);
				persistentPath = destFile.uri;
			} catch (copyErr) {
				logger.warn(
					"InspectPreview",
					"Persistent copy failed, using original URI",
					copyErr,
				);
			}

			const db = await getDb();
			const cleanKwh = kwhInput.trim();
			const parsedKwh = cleanKwh ? Number.parseFloat(cleanKwh) : null;
			const hasValidKwh =
				parsedKwh !== null &&
				!Number.isNaN(parsedKwh) &&
				Number.isFinite(parsedKwh) &&
				parsedKwh >= 0;

			const effectiveStatus =
				forceCriticalHazard || isHazard
					? "CRITICAL_HAZARD"
					: hasValidKwh
						? "PASS"
						: "WARNING";

			const effectiveHazardReason =
				forceCriticalHazard || isHazard
					? safetyResult?.reason ||
						"Exposed terminal wiring or unseated cover detected"
					: hasValidKwh
						? null
						: "Manual review required — unconfirmed reading";

			let lat = params.latitude ? Number.parseFloat(params.latitude) : 0;
			let lon = params.longitude ? Number.parseFloat(params.longitude) : 0;
			if (lat === 0 && lon === 0) {
				const c = getCachedCoordinates() || (await getCurrentCoordinates());
				lat = c.latitude;
				lon = c.longitude;
			}

			await insertInspection(db, {
				id,
				technician_id: "field_tech",
				device_id: "device_01",
				meter_serial_number:
					serialInput.trim().toUpperCase() ||
					`EB${(Date.now() % 900000) + 100000}`,
				latitude: lat,
				longitude: lon,
				timestamp_utc: new Date().toISOString(),
				qa_status: effectiveStatus,
				hazard_reason: effectiveHazardReason,
				extracted_kwh:
					effectiveStatus === "CRITICAL_HAZARD"
						? null
						: hasValidKwh
							? parsedKwh
							: null,
				ocr_confidence:
					effectiveStatus === "CRITICAL_HAZARD"
						? (safetyResult?.hazardProb ?? 0.9)
						: (ocrResult?.confidence ?? 0.9),
				image_local_path: persistentPath,
				inference_status: "DONE",
				sync_tier1_status: "PENDING",
				sync_tier2_status: "PENDING",
				tilt_deg: tiltDeg,
				crop_bounds_json: JSON.stringify(currentCropBounds),
			});

			logger.info(
				"InspectPreview",
				`Saved inspection ${id}: ${effectiveStatus} (kwh=${parsedKwh})`,
			);

			// Return to dashboard instantly
			router.replace("/");
		} catch (err) {
			logger.error("InspectPreview", "Failed saving inspection", err);
			setIsSubmitting(false);
		}
	};

	return (
		<SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
			<StatusBar style="dark" />
			<KeyboardAvoidingView
				style={styles.keyboardRoot}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				{/* TOP NAVIGATION BAR */}
				<View style={styles.topNav}>
					<Pressable
						style={styles.backButton}
						onPress={() => router.back()}
						hitSlop={8}
					>
						<AppSymbol name="back" size={20} color={MD3.color.onSurface} />
						<Text style={styles.backText}>Retake</Text>
					</Pressable>

					<Text style={styles.topTitle}>Verification</Text>

					<View style={styles.tiltBadge}>
						<Text style={styles.tiltBadgeText}>
							{Math.round(tiltDeg)}° Tilt
						</Text>
					</View>
				</View>

				{/* INFERENCE PROGRESS INDICATOR */}
				{isProcessing && (
					<View style={styles.progressBanner}>
						<ActivityIndicator size="small" color={MD3.color.primary} />
						<Text style={styles.progressText}>{statusText}</Text>
					</View>
				)}

				<ScrollView
					style={styles.scrollBody}
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps="handled"
				>
					{/* DUAL IMAGE VISUAL PROOF LAYOUT */}
					<View style={styles.visualProofContainer}>
						<View style={styles.dualImageRow}>
							{/* Full Meter Photo */}
							<View style={styles.imageCard}>
								<View style={styles.imageHeader}>
									<AppSymbol name="camera" size={14} color="#64748B" />
									<Text style={styles.imageCardTitle}>Full Meter Photo</Text>
								</View>
								<View style={styles.imageWrapper}>
									<Image
										source={{ uri: photoUri }}
										style={styles.fullImageThumb}
										contentFit="cover"
										transition={200}
									/>
									<View style={styles.cloudBadge}>
										<Text style={styles.cloudBadgeText}>Uploads to Admin</Text>
									</View>
								</View>
							</View>

							{/* Cropped Blue Reticle */}
							<View style={styles.imageCard}>
								<View style={styles.imageHeader}>
									<AppSymbol name="meter" size={14} color="#2563EB" />
									<Text style={styles.imageCardTitle}>
										Cropped Blue Reticle
									</Text>
								</View>
								<View style={[styles.imageWrapper, styles.cropWrapper]}>
									{croppedUri ? (
										<Image
											source={{ uri: croppedUri }}
											style={styles.croppedImageThumb}
											contentFit="contain"
											transition={200}
										/>
									) : (
										<View style={styles.cropPlaceholder}>
											<ActivityIndicator size="small" color="#2563EB" />
											<Text style={styles.cropPlaceholderText}>
												Cropping...
											</Text>
										</View>
									)}
									<View style={styles.mlkitBadge}>
										<Text style={styles.mlkitBadgeText}>ML Kit Input</Text>
									</View>
								</View>
								<Pressable
									style={styles.adjustCropBtn}
									onPress={() => setIsCropperVisible(true)}
								>
									<AppSymbol name="edit" size={13} color="#1D4ED8" />
									<Text style={styles.adjustCropBtnText}>Adjust Crop ✎</Text>
								</Pressable>
							</View>
						</View>
					</View>

					{/* STEP A: WIRE SAFETY CARD */}
					<View style={styles.sectionCard}>
						<View style={styles.sectionHeaderRow}>
							<Text style={styles.sectionNumber}>STEP A</Text>
							<Text style={styles.sectionTitle}>
								Wire Safety & Terminal Integrity
							</Text>
						</View>

						{isProcessing && !safetyResult ? (
							<View style={styles.evaluatingBox}>
								<ActivityIndicator size="small" color={MD3.color.primary} />
								<Text style={styles.evaluatingText}>
									Evaluating MobileNetV3 INT8 wire model...
								</Text>
							</View>
						) : isHazard ? (
							<View style={styles.hazardBanner}>
								<View style={styles.bannerTopRow}>
									<AppSymbol name="hazard" size={20} color={MD3.color.error} />
									<Text style={styles.hazardTitle}>
										CRITICAL HAZARD — Exposed Wiring Detected
									</Text>
								</View>
								<Text style={styles.hazardDescription}>
									{safetyResult?.reason ||
										"Exposed phase conductors or unseated terminal cover detected."}
								</Text>
								<Text style={styles.hazardProbText}>
									Hazard Probability:{" "}
									{((safetyResult?.hazardProb ?? 0.9) * 100).toFixed(1)}%
									(Threshold: 65%)
								</Text>
							</View>
						) : (
							<View style={styles.safeBanner}>
								<View style={styles.bannerTopRow}>
									<AppSymbol name="check" size={20} color={MD3.color.success} />
									<Text style={styles.safeTitle}>SAFE — No Exposed Wiring</Text>
								</View>
								<Text style={styles.safeDescription}>
									Terminal cover seated and phase conductors properly insulated.
								</Text>
								{safetyResult && (
									<Text style={styles.safeProbText}>
										Safety Confidence:{" "}
										{((1.0 - safetyResult.hazardProb) * 100).toFixed(1)}%
									</Text>
								)}
							</View>
						)}
					</View>

					{/* STEP B: CROPPED LCD READING & SERIAL NUMBER */}
					<View style={styles.sectionCard}>
						<View style={styles.sectionHeaderRow}>
							<Text style={styles.sectionNumber}>STEP B</Text>
							<Text style={styles.sectionTitle}>
								Cropped LCD Reading & Serial
							</Text>
						</View>

						<Text style={styles.helperText}>
							Compare the digits directly against the Cropped Blue Reticle image
							above. Edit if glare distorted any digit.
						</Text>

						{/* kWh Reading Input */}
						<View style={styles.inputGroup}>
							<View style={styles.inputLabelRow}>
								<Text style={styles.inputLabel}>TOTAL CONSUMPTION (kWh)</Text>
								{ocrResult?.kwh !== null && ocrResult?.kwh !== undefined && (
									<View style={styles.detectedBadge}>
										<Text style={styles.detectedBadgeText}>
											ML Kit Detected
										</Text>
									</View>
								)}
							</View>
							<TextInput
								style={[
									styles.textInput,
									styles.kwhInput,
									isHazard && styles.disabledInput,
								]}
								editable={!isHazard && !isSubmitting}
								value={kwhInput}
								onChangeText={setKwhInput}
								placeholder="0507106"
								placeholderTextColor="#94A3B8"
								keyboardType="numeric"
								autoCapitalize="none"
							/>
						</View>

						{/* Serial Number Input */}
						<View style={styles.inputGroup}>
							<View style={styles.inputLabelRow}>
								<Text style={styles.inputLabel}>METER SERIAL NUMBER</Text>
								{initialBarcode ? (
									<View style={styles.scannedBadge}>
										<Text style={styles.scannedBadgeText}>Barcode Scanned</Text>
									</View>
								) : null}
							</View>
							<TextInput
								style={[styles.textInput, isHazard && styles.disabledInput]}
								editable={!isHazard && !isSubmitting}
								value={serialInput}
								onChangeText={setSerialInput}
								placeholder="EB123456"
								placeholderTextColor="#94A3B8"
								autoCapitalize="characters"
							/>
						</View>
					</View>
				</ScrollView>

				{/* BOTTOM ACTION BUTTONS */}
				<View style={styles.bottomBar}>
					{isHazard ? (
						<View style={styles.actionButtonGroup}>
							<Pressable
								style={[styles.btn, styles.lockHazardBtn]}
								onPress={() => handleSave(true)}
								disabled={isSubmitting}
							>
								{isSubmitting ? (
									<ActivityIndicator size="small" color="#FFFFFF" />
								) : (
									<>
										<AppSymbol name="hazard" size={18} color="#FFFFFF" />
										<Text style={styles.lockHazardBtnText}>
											Log Hazard & Lock
										</Text>
									</>
								)}
							</Pressable>

							<Pressable
								style={[styles.btn, styles.retakeBtn]}
								onPress={() => router.back()}
								disabled={isSubmitting}
							>
								<Text style={styles.retakeBtnText}>Retake Photo</Text>
							</Pressable>
						</View>
					) : (
						<View style={styles.actionButtonGroup}>
							<Pressable
								style={[
									styles.btn,
									styles.saveDoneBtn,
									(isProcessing || isSubmitting) && styles.disabledBtn,
								]}
								onPress={() => handleSave(false)}
								disabled={isProcessing || isSubmitting}
							>
								{isSubmitting ? (
									<ActivityIndicator size="small" color="#FFFFFF" />
								) : (
									<>
										<AppSymbol name="check" size={18} color="#FFFFFF" />
										<Text style={styles.saveDoneBtnText}>Save & Done</Text>
									</>
								)}
							</Pressable>

							<Pressable
								style={[styles.btn, styles.secondaryRetakeBtn]}
								onPress={() => router.back()}
								disabled={isSubmitting}
							>
								<Text style={styles.secondaryRetakeText}>Retake</Text>
							</Pressable>
						</View>
					)}
				</View>
			</KeyboardAvoidingView>

			{/* CAMSCANNER-STYLE MANUAL LCD CROPPER MODAL */}
			<CamScannerCropperModal
				visible={isCropperVisible}
				imageUri={photoUri}
				initialBounds={currentCropBounds}
				onClose={() => setIsCropperVisible(false)}
				onConfirmCrop={handleManualCropConfirm}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#FFFFFF",
	},
	keyboardRoot: {
		flex: 1,
	},

	topNav: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
	},
	backButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 8,
	},
	backText: {
		fontSize: 14,
		fontWeight: "600",
		color: MD3.color.onSurface,
	},
	topTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: MD3.color.onSurface,
	},
	tiltBadge: {
		backgroundColor: "#F1F5F9",
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	tiltBadgeText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#475569",
	},

	progressBanner: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		paddingVertical: 8,
		paddingHorizontal: 16,
		backgroundColor: "#EFF6FF",
		borderBottomWidth: 1,
		borderBottomColor: "#BFDBFE",
	},
	progressText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#1D4ED8",
	},

	scrollBody: {
		flex: 1,
		backgroundColor: "#F8FAFC",
	},
	scrollContent: {
		padding: 16,
		gap: 16,
	},

	visualProofContainer: {
		backgroundColor: "#FFFFFF",
		borderRadius: 14,
		padding: 12,
		borderWidth: 1,
		borderColor: "#E2E8F0",
	},
	dualImageRow: {
		flexDirection: "row",
		gap: 12,
	},
	imageCard: {
		flex: 1,
		gap: 6,
	},
	imageHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	imageCardTitle: {
		fontSize: 11,
		fontWeight: "700",
		color: "#475569",
		textTransform: "uppercase",
		letterSpacing: 0.3,
	},
	imageWrapper: {
		height: 140,
		borderRadius: 10,
		overflow: "hidden",
		backgroundColor: "#0F172A",
		position: "relative",
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	cropWrapper: {
		borderColor: "#60A5FA",
		backgroundColor: "#020617",
	},
	fullImageThumb: {
		width: "100%",
		height: "100%",
	},
	croppedImageThumb: {
		width: "100%",
		height: "100%",
	},
	cropPlaceholder: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
	},
	cropPlaceholderText: {
		color: "#94A3B8",
		fontSize: 11,
		fontWeight: "500",
	},
	cloudBadge: {
		position: "absolute",
		bottom: 6,
		left: 6,
		backgroundColor: "rgba(15, 23, 42, 0.75)",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
	},
	cloudBadgeText: {
		color: "#FFFFFF",
		fontSize: 9,
		fontWeight: "600",
	},
	mlkitBadge: {
		position: "absolute",
		bottom: 6,
		left: 6,
		backgroundColor: "rgba(30, 58, 138, 0.85)",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
	},
	mlkitBadgeText: {
		color: "#93C5FD",
		fontSize: 9,
		fontWeight: "600",
	},
	adjustCropBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		backgroundColor: "#EFF6FF",
		paddingVertical: 6,
		paddingHorizontal: 8,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "#BFDBFE",
		marginTop: 4,
	},
	adjustCropBtnText: {
		color: "#1D4ED8",
		fontSize: 11,
		fontWeight: "600",
	},

	sectionCard: {
		backgroundColor: "#FFFFFF",
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		gap: 12,
	},
	sectionHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	sectionNumber: {
		fontSize: 11,
		fontWeight: "800",
		color: MD3.color.primary,
		backgroundColor: "#EFF6FF",
		paddingVertical: 2,
		paddingHorizontal: 6,
		borderRadius: 4,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "700",
		color: "#1E293B",
	},
	helperText: {
		fontSize: 12,
		color: "#64748B",
		lineHeight: 17,
	},

	evaluatingBox: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		padding: 12,
		backgroundColor: "#F8FAFC",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#E2E8F0",
	},
	evaluatingText: {
		fontSize: 12,
		color: "#475569",
	},

	hazardBanner: {
		backgroundColor: "#FEF2F2",
		borderRadius: 10,
		padding: 14,
		borderWidth: 1.5,
		borderColor: "#FCA5A5",
		gap: 6,
	},
	bannerTopRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	hazardTitle: {
		fontSize: 13,
		fontWeight: "800",
		color: "#991B1B",
		flex: 1,
	},
	hazardDescription: {
		fontSize: 12,
		color: "#7F1D1D",
		lineHeight: 16,
	},
	hazardProbText: {
		fontSize: 11,
		fontWeight: "700",
		color: "#DC2626",
		marginTop: 2,
	},

	safeBanner: {
		backgroundColor: "#F0FDF4",
		borderRadius: 10,
		padding: 14,
		borderWidth: 1.5,
		borderColor: "#86EFAC",
		gap: 6,
	},
	safeTitle: {
		fontSize: 13,
		fontWeight: "800",
		color: "#166534",
		flex: 1,
	},
	safeDescription: {
		fontSize: 12,
		color: "#14532D",
		lineHeight: 16,
	},
	safeProbText: {
		fontSize: 11,
		fontWeight: "700",
		color: "#15803D",
		marginTop: 2,
	},

	inputGroup: {
		gap: 6,
	},
	inputLabelRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	inputLabel: {
		fontSize: 11,
		fontWeight: "700",
		color: "#475569",
		letterSpacing: 0.4,
	},
	detectedBadge: {
		backgroundColor: "#DCFCE7",
		paddingVertical: 2,
		paddingHorizontal: 6,
		borderRadius: 4,
	},
	detectedBadgeText: {
		fontSize: 10,
		fontWeight: "700",
		color: "#15803D",
	},
	scannedBadge: {
		backgroundColor: "#DBEAFE",
		paddingVertical: 2,
		paddingHorizontal: 6,
		borderRadius: 4,
	},
	scannedBadgeText: {
		fontSize: 10,
		fontWeight: "700",
		color: "#1D4ED8",
	},

	textInput: {
		height: 48,
		backgroundColor: "#F8FAFC",
		borderWidth: 1,
		borderColor: "#CBD5E1",
		borderRadius: 10,
		paddingHorizontal: 14,
		fontSize: 16,
		fontWeight: "600",
		color: "#0F172A",
		fontFamily: Fonts.mono,
	},
	kwhInput: {
		fontSize: 20,
		fontWeight: "700",
		letterSpacing: 1.5,
		borderColor: "#3B82F6",
		backgroundColor: "#FFFFFF",
	},
	disabledInput: {
		backgroundColor: "#F1F5F9",
		color: "#94A3B8",
		borderColor: "#E2E8F0",
	},

	bottomBar: {
		padding: 16,
		borderTopWidth: 1,
		borderTopColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
	},
	actionButtonGroup: {
		gap: 10,
	},
	btn: {
		height: 50,
		borderRadius: 12,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
	},
	saveDoneBtn: {
		backgroundColor: MD3.color.primary,
	},
	saveDoneBtnText: {
		fontSize: 15,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	secondaryRetakeBtn: {
		backgroundColor: "#F1F5F9",
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	secondaryRetakeText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#475569",
	},
	lockHazardBtn: {
		backgroundColor: MD3.color.error,
	},
	lockHazardBtnText: {
		fontSize: 15,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	retakeBtn: {
		backgroundColor: "#F1F5F9",
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	retakeBtnText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#475569",
	},
	disabledBtn: {
		opacity: 0.5,
	},
});
