import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppSymbol } from "@/components/app-symbol";
import {
	CloudSyncProgressBar,
	type SyncProgressData,
} from "@/components/cloud-sync-progress-bar";
import { Fonts, MD3 } from "@/constants/theme";
import { getDb } from "@/core/db/client";
import {
	getActiveClientMessages,
	getInspections,
	getOrCreateDeviceId,
	getQueueMetrics,
	getReviewQueue,
	getSetting,
	recordClientAck,
} from "@/core/db/repository";
import { useTheme } from "@/core/theme-context";
import type {
	ClientMessage,
	InspectionRecord,
	QueueMetrics,
} from "@/core/types/inspection";
import {
	executeTier1Sync,
	getTier1BackoffInfo,
	reconcileCloudAuditStatus,
	syncClientMessages,
} from "@/services/sync/tier1-sync";
import { executeTier2MediaSync } from "@/services/sync/tier2-sync";
import {
	deviceWsClient,
	type WsStatus,
} from "@/services/sync/websocket-client";

const DEFAULT_GATEWAY_URL = "https://psychic-spark.onrender.com";

export default function DashboardScreen() {
	const router = useRouter();
	const { isDark, colors } = useTheme();
	const [wsStatus, setWsStatus] = useState<WsStatus>("DISCONNECTED");
	const [search, setSearch] = useState("");
	const [refreshing, setRefreshing] = useState(false);
	const [syncProgress, setSyncProgress] = useState<SyncProgressData>({
		active: false,
		stage: "IDLE",
		progress: 0,
		title: "",
		message: "",
	});
	const [isSyncing, setIsSyncing] = useState(false);
	const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
	const [metrics, setMetrics] = useState<QueueMetrics>({
		pendingTelemetry: 0,
		syncedTelemetry: 0,
		pendingImages: 0,
		needsReview: 0,
		pendingMl: 0,
	});
	const [history, setHistory] = useState<InspectionRecord[]>([]);
	const [reviewQueue, setReviewQueue] = useState<InspectionRecord[]>([]);
	const [activeMessages, setActiveMessages] = useState<ClientMessage[]>([]);
	const [replyNotes, setReplyNotes] = useState<{ [msgId: string]: string }>({});

	const loadData = useCallback(async () => {
		const db = await getDb();
		const [m, rows, review, savedUrl, msgs] = await Promise.all([
			getQueueMetrics(db),
			getInspections(db, search),
			getReviewQueue(db),
			getSetting(db, "gateway_url", DEFAULT_GATEWAY_URL),
			getActiveClientMessages(db),
		]);
		setMetrics(m);
		setHistory(rows);
		setReviewQueue(review);
		setGatewayUrl(savedUrl);
		setActiveMessages(msgs);
	}, [search]);

	useEffect(() => {
		return deviceWsClient.subscribeStatus((st) => setWsStatus(st));
	}, []);

	// Initialize real-time WebSocket connection to gateway
	useEffect(() => {
		let isMounted = true;
		(async () => {
			const db = await getDb();
			if (!isMounted) return;
			deviceWsClient.init(db, gatewayUrl, "TECH-01", () => {
				if (isMounted) loadData();
			});
		})();
		return () => {
			isMounted = false;
			deviceWsClient.disconnect();
		};
	}, [gatewayUrl, loadData]);

	useFocusEffect(
		useCallback(() => {
			loadData();
		}, [loadData]),
	);

	const handleAcknowledgeMessage = async (msgId: string) => {
		const db = await getDb();
		const devId = await getOrCreateDeviceId(db);
		const userReply = replyNotes[msgId]?.trim() || "Acknowledged by technician";

		// 1. Try real-time WebSocket push first
		const wsSent = deviceWsClient.sendAck(
			msgId,
			"ACTIONED",
			"TECH-01",
			userReply,
		);

		// 2. Persist in local SQLite (SSOT)
		await recordClientAck(db, msgId, devId, "TECH-01", "ACTIONED", userReply);

		setReplyNotes((prev) => {
			const updated = { ...prev };
			delete updated[msgId];
			return updated;
		});

		await loadData();

		// 3. Fallback HTTP flush if WS was offline
		if (!wsSent) {
			await syncClientMessages(db, gatewayUrl, devId, "TECH-01");
		}
	};

	const handleSync = async () => {
		if (isSyncing) return;
		setIsSyncing(true);
		setRefreshing(true);
		setSyncProgress({
			active: true,
			stage: "CONNECTING",
			progress: 0.05,
			title: "GATEWAY PING",
			message: "Connecting to cloud gateway...",
		});

		const db = await getDb();
		const devId = await getOrCreateDeviceId(db);

		const tier1Success = await executeTier1Sync(db, gatewayUrl, {
			force: true,
			onPingAttempt: (attempt, max) => {
				setSyncProgress((prev) => ({
					...prev,
					stage: "CONNECTING",
					progress: 0.05 + (attempt / max) * 0.15,
					title: "GATEWAY PING",
					message: `Testing cloud latency (${attempt}/${max})...`,
				}));
			},
			onMetadataProgress: (meta) => {
				if (meta.stage === "PREPARING") {
					setSyncProgress((prev) => ({
						...prev,
						stage: "METADATA",
						progress: 0.22,
						title: "METADATA SYNC",
						message: "Scanning pending queue...",
					}));
				} else if (meta.stage === "EMPTY") {
					setSyncProgress((prev) => ({
						...prev,
						stage: "METADATA",
						progress: 0.45,
						title: "METADATA SYNC",
						message: "0 pending inspection records",
					}));
				} else if (meta.stage === "UPLOADING") {
					setSyncProgress((prev) => ({
						...prev,
						stage: "METADATA",
						progress: 0.35,
						title: "METADATA SYNC",
						message: `Uploading ${meta.recordCount} inspection record${meta.recordCount > 1 ? "s" : ""}...`,
					}));
				} else if (meta.stage === "SYNCED") {
					setSyncProgress((prev) => ({
						...prev,
						stage: "METADATA",
						progress: 0.5,
						title: "METADATA SYNC",
						message: `${meta.recordCount} record${meta.recordCount > 1 ? "s" : ""} acknowledged`,
					}));
				} else if (meta.stage === "ERROR") {
					setSyncProgress((prev) => ({
						...prev,
						stage: "ERROR",
						progress: 0.3,
						title: "SYNC ERROR",
						message: meta.error || "Batch dispatch rejected",
						error: true,
					}));
				}
			},
		});

		if (tier1Success) {
			setSyncProgress({
				active: true,
				stage: "MEDIA",
				progress: 0.52,
				title: "AUDIT PHOTOS",
				message: "Checking pending casing photos...",
			});

			await executeTier2MediaSync(db, gatewayUrl, {
				onProgress: (photo) => {
					if (photo.status === "DONE" && photo.total === 0) {
						setSyncProgress((prev) => ({
							...prev,
							stage: "MEDIA",
							progress: 0.8,
							title: "AUDIT PHOTOS",
							message: "All meter photos previously synced",
						}));
					} else if (photo.status === "UPLOADING") {
						const stepProg = 0.52 + ((photo.current - 1) / photo.total) * 0.28;
						setSyncProgress((prev) => ({
							...prev,
							stage: "MEDIA",
							progress: stepProg,
							title: "AUDIT PHOTOS",
							message: `Uploading photo ${photo.current} of ${photo.total} (${photo.inspectionId})...`,
						}));
					} else if (photo.status === "SUCCESS") {
						const stepProg = 0.52 + (photo.current / photo.total) * 0.28;
						setSyncProgress((prev) => ({
							...prev,
							stage: "MEDIA",
							progress: stepProg,
							title: "AUDIT PHOTOS",
							message: `Photo ${photo.current} of ${photo.total} uploaded`,
						}));
					}
				},
			});

			setSyncProgress({
				active: true,
				stage: "COMPLETE",
				progress: 1.0,
				title: "SYNC COMPLETE",
				message: "All records and photos uploaded",
			});

			// Asynchronously audit VLM readings & flush directives in background
			(async () => {
				try {
					await reconcileCloudAuditStatus(db, gatewayUrl, devId);
					await syncClientMessages(db, gatewayUrl, devId, "TECH-01");
					loadData();
				} catch {}
			})();
		} else {
			const backoff = getTier1BackoffInfo();
			const errMsg =
				backoff.lastError === "Server not reachable"
					? "Server not reachable"
					: `Offline (${backoff.cooldownSecondsRemaining}s cooldown)`;

			setSyncProgress({
				active: true,
				stage: "ERROR",
				progress: 0.25,
				title: "GATEWAY OFFLINE",
				message: errMsg,
				error: true,
			});
		}

		await loadData();
		setRefreshing(false);
		setIsSyncing(false);
		setTimeout(() => {
			setSyncProgress((prev) =>
				prev.stage === "COMPLETE"
					? { ...prev, active: false, stage: "IDLE" }
					: prev,
			);
		}, 3500);
	};

	const openInspectionEditor = (item: InspectionRecord) => {
		router.push({
			pathname: "/validation",
			params: {
				inspectionId: item.id,
				sn: item.meter_serial_number,
				kwh: item.extracted_kwh != null ? String(item.extracted_kwh) : "",
				confidence:
					item.ocr_confidence != null
						? item.ocr_confidence.toFixed(3)
						: "0.000",
				status: item.qa_status,
				hazard: item.hazard_reason || "",
				imagePath: item.image_local_path,
				decimalInferred: "0",
				source: "vision_ocr",
				auditStage: item.audit_stage || "",
				vlmKwh: item.vlm_kwh != null ? String(item.vlm_kwh) : "",
				vlmNotes: item.vlm_notes || "",
				vlmSummary: item.vlm_summary || "",
				vlmTags: item.vlm_tags || "",
				qcChecklist: item.qc_checklist_json || "",
			},
		});
	};

	return (
		<SafeAreaView
			style={[styles.screen, { backgroundColor: colors.background }]}
			edges={["top", "bottom"]}
		>
			<StatusBar style={isDark ? "light" : "dark"} />

			{/* HEADER */}
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<Pressable
						style={[
							styles.wsDotBtn,
							{
								backgroundColor:
									wsStatus === "CONNECTED"
										? "#22c55e"
										: wsStatus === "CONNECTING"
											? "#f59e0b"
											: "#ef4444",
							},
						]}
						onPress={() => deviceWsClient.reconnect()}
						accessibilityLabel={`WebSocket: ${wsStatus}`}
					/>
					<Text style={[styles.title, { color: colors.text }]}>
						Inspections
					</Text>
				</View>
				<View style={styles.headerRight}>
					<Pressable
						style={({ pressed }) => [
							styles.iconBtn,
							{
								backgroundColor: colors.backgroundElement,
								borderColor: colors.border,
							},
							pressed && styles.btnPressed,
						]}
						onPress={() => router.push("/settings")}
					>
						<AppSymbol name="settings" size={20} color={colors.text} />
					</Pressable>
					<Pressable
						style={({ pressed }) => [
							styles.primaryFab,
							pressed && styles.fabPressed,
						]}
						onPress={() => router.push("/capture")}
					>
						<AppSymbol name="camera" size={18} color="#FFFFFF" />
						<Text style={styles.primaryFabText}>Scan</Text>
					</Pressable>
				</View>
			</View>

			{/* ACTIVE ADMIN DIRECTIVES & ALERTS */}
			{activeMessages.length > 0 && (
				<View style={styles.alertContainer}>
					{activeMessages.slice(0, 2).map((msg) => (
						<View
							key={msg.id}
							style={[
								styles.alertCard,
								msg.priority === "URGENT" || msg.priority === "CRITICAL"
									? styles.alertCardUrgent
									: styles.alertCardNormal,
							]}
						>
							<View style={styles.alertContent}>
								<View style={styles.alertHeader}>
									<Text style={styles.alertBadge}>
										{msg.priority} &bull; {msg.message_type}
									</Text>
								</View>
								<Text style={styles.alertTitle}>{msg.title}</Text>
								<Text style={styles.alertBody}>{msg.body}</Text>
								<TextInput
									style={styles.replyInput}
									placeholder="Add field note or reply..."
									placeholderTextColor="#9CA3AF"
									value={replyNotes[msg.id] ?? ""}
									onChangeText={(txt) =>
										setReplyNotes((prev) => ({ ...prev, [msg.id]: txt }))
									}
								/>
							</View>
							<Pressable
								style={({ pressed }) => [
									styles.ackBtn,
									pressed && styles.btnPressed,
								]}
								onPress={() => handleAcknowledgeMessage(msg.id)}
							>
								<Text style={styles.ackBtnText}>Reply & ACK</Text>
							</Pressable>
						</View>
					))}
				</View>
			)}

			{/* MD3 METRICS ROW */}
			<View
				style={[
					styles.metricsCard,
					{
						backgroundColor: colors.backgroundElement,
						borderColor: colors.border,
					},
				]}
			>
				<View style={styles.metricItem}>
					<Text style={[styles.metricValue, { color: colors.text }]}>
						{metrics.pendingTelemetry}
					</Text>
					<Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
						Queued
					</Text>
				</View>
				<View
					style={[styles.metricDivider, { backgroundColor: colors.border }]}
				/>
				<View style={styles.metricItem}>
					<Text style={[styles.metricValue, { color: MD3.color.success }]}>
						{metrics.syncedTelemetry}
					</Text>
					<Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
						Synced
					</Text>
				</View>
				<View
					style={[styles.metricDivider, { backgroundColor: colors.border }]}
				/>
				<View style={styles.metricItem}>
					<Text style={[styles.metricValue, { color: colors.text }]}>
						{metrics.pendingImages}
					</Text>
					<Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
						Photos
					</Text>
				</View>
				<View
					style={[styles.metricDivider, { backgroundColor: colors.border }]}
				/>
				<View style={styles.metricItem}>
					<Text
						style={[
							styles.metricValue,
							{
								color:
									metrics.pendingMl > 0
										? MD3.color.primary
										: colors.textSecondary,
							},
						]}
					>
						{metrics.pendingMl}
					</Text>
					<Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
						ML
					</Text>
				</View>
				<View
					style={[styles.metricDivider, { backgroundColor: colors.border }]}
				/>
				<View style={styles.metricItem}>
					<Text
						style={[
							styles.metricValue,
							{
								color:
									metrics.needsReview > 0
										? MD3.color.warn
										: colors.textSecondary,
							},
						]}
					>
						{metrics.needsReview}
					</Text>
					<Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
						Review
					</Text>
				</View>
			</View>

			{/* CLOUD SYNC PROGRESS BAR */}
			<CloudSyncProgressBar data={syncProgress} />

			{/* SEARCH BAR */}
			<View
				style={[
					styles.searchBar,
					{
						backgroundColor: colors.backgroundElement,
						borderColor: colors.border,
					},
				]}
			>
				<AppSymbol name="search" size={16} color={colors.textSecondary} />
				<TextInput
					style={[styles.searchInput, { color: colors.text }]}
					placeholder="Search Serial Number"
					placeholderTextColor={colors.textSecondary}
					value={search}
					onChangeText={setSearch}
				/>
			</View>

			{/* CONTENT LIST */}
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={styles.listArea}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={handleSync} />
				}
			>
				{/* REVIEW QUEUE */}
				{reviewQueue.length > 0 && (
					<View style={styles.section}>
						<Text
							style={[styles.sectionHeader, { color: colors.textSecondary }]}
						>
							Needs Review ({reviewQueue.length})
						</Text>
						{reviewQueue.map((item) => (
							<Pressable
								key={item.id}
								style={({ pressed }) => [
									styles.card,
									styles.reviewCard,
									{
										backgroundColor: colors.backgroundElement,
										borderColor: colors.border,
									},
									pressed && styles.cardPressed,
								]}
								onPress={() => openInspectionEditor(item)}
							>
								<View style={styles.cardContentRow}>
									{item.image_local_path ? (
										<Image
											source={{ uri: item.image_local_path }}
											style={styles.thumbImage}
											contentFit="cover"
											transition={200}
										/>
									) : (
										<View style={styles.thumbPlaceholder}>
											<AppSymbol
												name="meter"
												size={20}
												color={MD3.color.outline}
											/>
										</View>
									)}

									<View style={styles.cardDetails}>
										<View style={styles.cardRow}>
											<Text style={[styles.snText, { color: colors.text }]}>
												{item.meter_serial_number || "UNKNOWN"}
											</Text>
											<View style={styles.warnChip}>
												<Text style={styles.warnChipText}>Review</Text>
											</View>
										</View>
										{item.vlm_kwh != null ? (
											<View style={styles.aiReadingRow}>
												<View
													style={[
														styles.aiChip,
														{
															backgroundColor: isDark ? "#064e3b" : "#DCFCE7",
															borderColor: isDark ? "#059669" : "#86EFAC",
														},
													]}
												>
													<Text
														style={[
															styles.aiChipText,
															{ color: isDark ? "#4ade80" : "#15803D" },
														]}
													>
														AI: {Number(item.vlm_kwh).toFixed(1)} kWh
													</Text>
												</View>
												<Text
													style={[
														styles.metaText,
														{ color: colors.textSecondary },
													]}
												>
													Tap to autofill
												</Text>
											</View>
										) : (
											<Text
												style={[
													styles.metaText,
													{ color: colors.textSecondary },
												]}
											>
												{item.extracted_kwh != null
													? `${item.extracted_kwh} kWh`
													: "No reading"}
											</Text>
										)}
									</View>
								</View>
							</Pressable>
						))}
					</View>
				)}

				{/* HISTORY */}
				<View style={styles.section}>
					<Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
						History ({history.length})
					</Text>
					{history.length === 0 ? (
						<View
							style={[
								styles.emptyCard,
								{
									backgroundColor: colors.backgroundElement,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={[styles.emptyText, { color: colors.textSecondary }]}>
								No records yet
							</Text>
						</View>
					) : (
						history.map((item) => {
							const isPendingMl =
								item.inference_status === "PENDING_ML" ||
								item.inference_status === "PROCESSING";
							const isPass = item.qa_status === "PASS";
							const isWarn = item.qa_status === "WARNING";

							return (
								<Pressable
									key={item.id}
									style={({ pressed }) => [
										styles.card,
										{
											backgroundColor: colors.backgroundElement,
											borderColor: colors.border,
										},
										pressed && styles.cardPressed,
									]}
									onPress={() => openInspectionEditor(item)}
								>
									<View style={styles.cardContentRow}>
										{item.image_local_path ? (
											<Image
												source={{ uri: item.image_local_path }}
												style={styles.thumbImage}
												contentFit="cover"
												transition={200}
											/>
										) : (
											<View style={styles.thumbPlaceholder}>
												<AppSymbol
													name="meter"
													size={20}
													color={MD3.color.outline}
												/>
											</View>
										)}

										<View style={styles.cardDetails}>
											<View style={styles.cardRow}>
												<Text style={[styles.snText, { color: colors.text }]}>
													{item.meter_serial_number || "UNKNOWN"}
												</Text>
												<View style={styles.badgesCluster}>
													{isPendingMl ? (
														<View style={styles.processChip}>
															<Text style={styles.processChipText}>
																In Process
															</Text>
														</View>
													) : (
														<View
															style={[
																styles.chip,
																isPass && styles.chipSuccess,
																isWarn && styles.chipWarn,
																!isPass && !isWarn && styles.chipError,
															]}
														>
															<Text
																style={[
																	styles.chipText,
																	isPass && styles.chipTextSuccess,
																	isWarn && styles.chipTextWarn,
																	!isPass && !isWarn && styles.chipTextError,
																]}
															>
																{item.qa_status === "CRITICAL_HAZARD"
																	? "HAZARD"
																	: item.qa_status}
															</Text>
														</View>
													)}

													{/* Two-Stage Cloud Acknowledgment Badge */}
													{item.audit_stage === "VLM_VERIFIED" ? (
														<View style={styles.vlmVerifiedChip}>
															<Text style={styles.vlmVerifiedText}>✓✓ VLM</Text>
														</View>
													) : item.audit_stage === "MISMATCH_FLAGGED" ? (
														<View style={styles.mismatchChip}>
															<Text style={styles.mismatchText}>
																⚠ Mismatch
															</Text>
														</View>
													) : item.sync_tier2_status === "SYNCED" ? (
														<View style={styles.uploadedChip}>
															<Text style={styles.uploadedText}>
																✓ Uploaded
															</Text>
														</View>
													) : null}
												</View>
											</View>
											{isPendingMl ? (
												<Text
													style={[
														styles.metaText,
														{ color: colors.textSecondary },
													]}
												>
													Running model on device...
												</Text>
											) : item.extracted_kwh != null ? (
												<Text
													style={[
														styles.metaText,
														{ color: colors.textSecondary },
													]}
												>
													{item.extracted_kwh} kWh
												</Text>
											) : item.vlm_kwh != null ? (
												<View style={styles.aiReadingRow}>
													<View
														style={[
															styles.aiChip,
															{
																backgroundColor: isDark ? "#064e3b" : "#DCFCE7",
																borderColor: isDark ? "#059669" : "#86EFAC",
															},
														]}
													>
														<Text
															style={[
																styles.aiChipText,
																{ color: isDark ? "#4ade80" : "#15803D" },
															]}
														>
															AI: {Number(item.vlm_kwh).toFixed(1)} kWh
														</Text>
													</View>
													<Text
														style={[
															styles.metaText,
															{ color: colors.textSecondary },
														]}
													>
														Tap to enter reading
													</Text>
												</View>
											) : (
												<Text
													style={[
														styles.metaText,
														{ color: colors.textSecondary },
													]}
												>
													Tap to enter reading
												</Text>
											)}
										</View>
									</View>
								</Pressable>
							);
						})
					)}
				</View>
			</ScrollView>

			{/* BOTTOM ACTION */}
			<View
				style={[
					styles.bottomBar,
					{
						backgroundColor: colors.background,
						borderColor: colors.border,
					},
				]}
			>
				<Pressable
					disabled={isSyncing}
					style={({ pressed }) => [
						styles.syncBtn,
						{
							backgroundColor: colors.backgroundElement,
							borderColor: colors.border,
						},
						isSyncing && styles.btnDisabled,
						pressed && styles.btnPressed,
					]}
					onPress={handleSync}
				>
					{isSyncing ? (
						<ActivityIndicator size="small" color={MD3.color.primary} />
					) : (
						<>
							<AppSymbol name="sync" size={16} color={MD3.color.primary} />
							<Text style={[styles.syncBtnText, { color: colors.text }]}>
								Sync Cloud
							</Text>
						</>
					)}
				</Pressable>
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
		paddingTop: 8,
		paddingBottom: 12,
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	wsDotBtn: {
		width: 10,
		height: 10,
		borderRadius: 5,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	aiChip: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		borderWidth: 1,
	},
	aiChipText: {
		fontSize: 10,
		fontFamily: Fonts.mono,
		fontWeight: "700",
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	alertContainer: {
		paddingHorizontal: 16,
		gap: 8,
		marginBottom: 10,
	},
	alertCard: {
		flexDirection: "row",
		alignItems: "center",
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
	},
	alertCardUrgent: {
		backgroundColor: "#FEF2F2",
		borderColor: "#FCA5A5",
	},
	alertCardNormal: {
		backgroundColor: "#EFF6FF",
		borderColor: "#BFDBFE",
	},
	alertContent: {
		flex: 1,
	},
	alertHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 2,
	},
	alertBadge: {
		fontSize: 10,
		fontWeight: "700",
		textTransform: "uppercase",
		color: "#B91C1C",
		letterSpacing: 0.5,
	},
	alertTitle: {
		fontSize: 13,
		fontWeight: "700",
		color: MD3.color.onSurface,
	},
	alertBody: {
		fontSize: 11,
		color: MD3.color.onSurfaceVariant,
		marginTop: 2,
	},
	replyInput: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#D1D5DB",
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
		fontSize: 11,
		color: "#111827",
		marginTop: 6,
	},
	ackBtn: {
		backgroundColor: "#18181B",
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 6,
		marginLeft: 8,
	},
	ackBtnText: {
		color: "#FFFFFF",
		fontSize: 11,
		fontWeight: "700",
	},
	title: {
		fontSize: 24,
		fontWeight: "700",
		color: MD3.color.onSurface,
		letterSpacing: -0.3,
	},
	iconBtn: {
		width: 40,
		height: 40,
		borderRadius: MD3.shape.cornerFull,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 1,
	},
	primaryFab: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: MD3.color.primary,
		paddingVertical: 10,
		paddingHorizontal: 18,
		borderRadius: MD3.shape.cornerFull,
	},
	fabPressed: {
		opacity: 0.85,
	},
	primaryFabText: {
		color: MD3.color.onPrimary,
		fontWeight: "600",
		fontSize: 14,
	},
	metricsCard: {
		flexDirection: "row",
		marginHorizontal: 16,
		backgroundColor: MD3.color.surfaceContainerLow,
		borderRadius: MD3.shape.cornerLarge,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
	},
	metricItem: {
		flex: 1,
		alignItems: "center",
	},
	metricDivider: {
		width: 1,
		backgroundColor: MD3.color.outlineVariant,
		marginVertical: 4,
	},
	metricValue: {
		fontSize: 18,
		fontWeight: "700",
		color: MD3.color.onSurface,
	},
	metricLabel: {
		fontSize: 11,
		color: MD3.color.onSurfaceVariant,
		marginTop: 2,
	},

	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: MD3.color.surfaceContainerLow,
		marginHorizontal: 16,
		marginTop: 10,
		paddingHorizontal: 12,
		height: 44,
		borderRadius: MD3.shape.cornerFull,
		gap: 8,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
	},
	searchInput: {
		flex: 1,
		fontSize: 14,
		color: MD3.color.onSurface,
	},
	listArea: {
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 20,
		gap: 16,
	},
	section: {
		gap: 8,
	},
	sectionHeader: {
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
		padding: 12,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
	},
	cardContentRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	thumbImage: {
		width: 54,
		height: 54,
		borderRadius: MD3.shape.cornerSmall,
		backgroundColor: MD3.color.surfaceContainerLow,
	},
	thumbPlaceholder: {
		width: 54,
		height: 54,
		borderRadius: MD3.shape.cornerSmall,
		backgroundColor: MD3.color.surfaceContainerLow,
		justifyContent: "center",
		alignItems: "center",
	},
	cardDetails: {
		flex: 1,
		gap: 4,
	},
	reviewCard: {
		backgroundColor: MD3.color.warnContainer,
		borderColor: "#FDE68A",
	},
	cardPressed: {
		opacity: 0.85,
	},
	cardRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	snText: {
		fontFamily: Fonts.mono,
		fontSize: 15,
		fontWeight: "600",
		color: MD3.color.onSurface,
		flexShrink: 1,
	},
	metaText: {
		fontSize: 13,
		color: MD3.color.onSurfaceVariant,
	},
	aiReadingRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 2,
	},
	chip: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: MD3.shape.cornerFull,
	},
	chipSuccess: {
		backgroundColor: MD3.color.successContainer,
	},
	chipWarn: {
		backgroundColor: MD3.color.warnContainer,
	},
	chipError: {
		backgroundColor: MD3.color.errorContainer,
	},
	chipText: {
		fontSize: 10,
		fontWeight: "700",
	},
	chipTextSuccess: {
		color: MD3.color.onSuccessContainer,
	},
	chipTextWarn: {
		color: MD3.color.onWarnContainer,
	},
	chipTextError: {
		color: MD3.color.onErrorContainer,
	},
	warnChip: {
		backgroundColor: "#FDE68A",
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: MD3.shape.cornerFull,
	},
	warnChipText: {
		fontSize: 11,
		fontWeight: "700",
		color: "#78350F",
	},
	processChip: {
		backgroundColor: MD3.color.surfaceContainerHighest,
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: MD3.shape.cornerFull,
	},
	processChipText: {
		fontSize: 10,
		fontWeight: "700",
		color: MD3.color.primary,
	},
	badgesCluster: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		flexShrink: 0,
		flexWrap: "wrap",
		justifyContent: "flex-end",
	},
	vlmVerifiedChip: {
		backgroundColor: "#CCFBF1",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: MD3.shape.cornerFull,
	},
	vlmVerifiedText: {
		fontSize: 9,
		fontWeight: "700",
		color: "#0F766E",
	},
	mismatchChip: {
		backgroundColor: "#FEF3C7",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: MD3.shape.cornerFull,
	},
	mismatchText: {
		fontSize: 9,
		fontWeight: "700",
		color: "#B45309",
	},
	uploadedChip: {
		backgroundColor: "#E0F2FE",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: MD3.shape.cornerFull,
	},
	uploadedText: {
		fontSize: 9,
		fontWeight: "700",
		color: "#0369A1",
	},
	emptyCard: {
		backgroundColor: MD3.color.surfaceContainerLow,
		borderRadius: MD3.shape.cornerMedium,
		padding: 24,
		alignItems: "center",
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
		borderStyle: "dashed",
	},
	emptyText: {
		fontSize: 13,
		color: MD3.color.onSurfaceVariant,
	},
	bottomBar: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderTopWidth: 1,
		borderColor: MD3.color.outlineVariant,
		backgroundColor: MD3.color.surface,
	},
	syncBtn: {
		height: 44,
		borderRadius: MD3.shape.cornerFull,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
		borderWidth: 1,
		borderColor: MD3.color.outlineVariant,
		backgroundColor: MD3.color.surfaceContainerLow,
	},
	syncBtnText: {
		color: MD3.color.primary,
		fontSize: 14,
		fontWeight: "600",
	},
	btnDisabled: {
		opacity: 0.5,
	},
	btnPressed: {
		backgroundColor: MD3.color.surfaceContainerHighest,
	},
});
