import type { SQLiteDatabase } from "expo-sqlite";
import { AppState, type AppStateStatus } from "react-native";
import {
	getAppVersion,
	getDeviceModel,
	getOrCreateDeviceId,
	upsertClientMessage,
} from "@/core/db/repository";
import { getCachedCoordinates, getCurrentCoordinates } from "@/core/location";
import { logger } from "@/core/logger";
import type { ClientMessage } from "@/core/types/inspection";
import { reconcileCloudAuditStatus } from "./tier1-sync";

export type WsStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED";

export interface DeviceTelemetry {
	lat: number;
	lon: number;
	battery?: number | null;
	technician_id: string;
}

class DeviceWebSocketService {
	private ws: WebSocket | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private currentUrl = "";
	private deviceId = "";
	private onMessageCallback: ((msg: ClientMessage) => void) | null = null;
	private cachedDb: SQLiteDatabase | null = null;
	private cachedGatewayUrl = "";
	private cachedTechnicianId = "TECH-01";
	private reconnectAttempts = 0;
	private isExplicitlyDisconnected = false;
	private status: WsStatus = "DISCONNECTED";
	private statusListeners: Set<(s: WsStatus) => void> = new Set();
	private appStateSubscription: ReturnType<
		typeof AppState.addEventListener
	> | null = null;

	constructor() {
		// Auto-reconnect when app comes back to foreground
		this.appStateSubscription = AppState.addEventListener(
			"change",
			(nextAppState: AppStateStatus) => {
				if (
					nextAppState === "active" &&
					this.status === "DISCONNECTED" &&
					!this.isExplicitlyDisconnected &&
					this.cachedDb &&
					this.cachedGatewayUrl
				) {
					logger.info(
						"DeviceWS",
						"App became active, triggering instant WS reconnect",
					);
					this.reconnect();
				}
			},
		);
	}

	public getStatus(): WsStatus {
		return this.status;
	}

	public subscribeStatus(listener: (s: WsStatus) => void): () => void {
		this.statusListeners.add(listener);
		listener(this.status);
		return () => {
			this.statusListeners.delete(listener);
		};
	}

	private setStatus(newStatus: WsStatus) {
		if (this.status !== newStatus) {
			this.status = newStatus;
			for (const listener of this.statusListeners) {
				try {
					listener(newStatus);
				} catch {}
			}
		}
	}

	public init(
		db: SQLiteDatabase,
		gatewayUrl: string,
		technicianId = "TECH-01",
		onMessage?: (msg: ClientMessage) => void,
	) {
		this.cachedDb = db;
		this.cachedGatewayUrl = gatewayUrl;
		this.cachedTechnicianId = technicianId;
		this.onMessageCallback = onMessage ?? null;
		this.isExplicitlyDisconnected = false;

		getOrCreateDeviceId(db).then((id) => {
			this.deviceId = id;
			this.connect(db, gatewayUrl, technicianId);
		});
	}

	public connect(
		db: SQLiteDatabase,
		gatewayUrl: string,
		technicianId = "TECH-01",
	) {
		this.cachedDb = db;
		this.cachedGatewayUrl = gatewayUrl;
		this.cachedTechnicianId = technicianId;
		this.isExplicitlyDisconnected = false;

		const wsBase = gatewayUrl.trim().replace(/^http/, "ws").replace(/\/+$/, "");
		const targetUrl = `${wsBase}/api/v1/ws/device/${this.deviceId}`;

		if (
			this.ws &&
			this.currentUrl === targetUrl &&
			this.status === "CONNECTED"
		) {
			return;
		}

		if (this.ws) {
			try {
				this.ws.close();
			} catch {}
			this.ws = null;
		}

		this.currentUrl = targetUrl;
		this.setStatus("CONNECTING");

		try {
			const socket = new WebSocket(targetUrl);
			this.ws = socket;

			socket.onopen = () => {
				logger.info("DeviceWS", `Connected to ${targetUrl}`);
				this.reconnectAttempts = 0;
				this.setStatus("CONNECTED");
				this.sendTelemetry(technicianId);

				if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
				this.heartbeatTimer = setInterval(
					() => this.sendTelemetry(technicianId),
					30000,
				);
			};

			socket.onmessage = async (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === "ADMIN_MESSAGE" && data.id) {
						const clientMsg: ClientMessage = {
							id: data.id,
							target_type: data.target_type ?? "BROADCAST",
							target_id: data.target_id ?? "ALL",
							message_type: data.message_type ?? "ALERT",
							priority: data.priority ?? "NORMAL",
							title: data.title ?? "Admin Alert",
							body: data.body ?? "",
							payload_json: data.payload_json ?? null,
							created_at: data.created_at ?? new Date().toISOString(),
							ack_status: "DELIVERED",
						};

						// Idempotent insertion
						await upsertClientMessage(db, clientMsg);

						// Send immediate DELIVERED ACK over WS
						this.sendAck(data.id, "DELIVERED", technicianId);

						this.onMessageCallback?.(clientMsg);
					} else if (data.type === "SYNC_BACK_REQUEST") {
						logger.info(
							"DeviceWS",
							"Received remote sync-back restore trigger from admin console",
						);
						if (this.cachedDb && this.cachedGatewayUrl) {
							reconcileCloudAuditStatus(
								this.cachedDb,
								this.cachedGatewayUrl,
								this.deviceId,
							).then((count) => {
								this.onMessageCallback?.({
									id: `restore-${Date.now()}`,
									target_type: "DEVICE",
									target_id: this.deviceId,
									message_type: "NOTICE",
									priority: "HIGH",
									title: "Cloud Data Restored",
									body: `Restored ${count} inspection record(s) and photos from cloud.`,
									payload_json: JSON.stringify(data),
									created_at: new Date().toISOString(),
									ack_status: "ACTIONED",
								});
							});
						}
					}
				} catch (err) {
					logger.warn("DeviceWS", "Failed to parse incoming WS message", err);
				}
			};

			socket.onclose = () => {
				this.handleSocketDrop();
			};

			socket.onerror = () => {
				this.handleSocketDrop();
			};
		} catch (e) {
			logger.warn("DeviceWS", "Connection failed", e);
			this.handleSocketDrop();
		}
	}

	private handleSocketDrop() {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		this.setStatus("DISCONNECTED");

		if (
			!this.isExplicitlyDisconnected &&
			this.cachedDb &&
			this.cachedGatewayUrl
		) {
			this.reconnectAttempts++;
			const delay = Math.min(
				15000,
				2000 * 1.5 ** Math.min(this.reconnectAttempts, 5),
			);
			if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
			this.reconnectTimer = setTimeout(() => {
				if (
					!this.isExplicitlyDisconnected &&
					this.cachedDb &&
					this.cachedGatewayUrl
				) {
					logger.info(
						"DeviceWS",
						`Auto-reconnecting attempt #${this.reconnectAttempts}...`,
					);
					this.connect(
						this.cachedDb,
						this.cachedGatewayUrl,
						this.cachedTechnicianId,
					);
				}
			}, delay);
		}
	}

	public reconnect() {
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		if (this.cachedDb && this.cachedGatewayUrl) {
			this.reconnectAttempts = 0;
			this.isExplicitlyDisconnected = false;
			this.connect(
				this.cachedDb,
				this.cachedGatewayUrl,
				this.cachedTechnicianId,
			);
		}
	}

	public async sendTelemetry(
		technicianId = "TECH-01",
		lat?: number,
		lon?: number,
		battery = 0.92,
	) {
		let currentLat = lat;
		let currentLon = lon;
		if (currentLat === undefined || currentLon === undefined) {
			const coords = getCachedCoordinates() || (await getCurrentCoordinates());
			currentLat = coords.latitude;
			currentLon = coords.longitude;
		}

		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({
					type: "TELEMETRY",
					lat: currentLat,
					lon: currentLon,
					battery,
					technician_id: technicianId,
					device_model: getDeviceModel(),
					app_version: getAppVersion(),
				}),
			);
		}
	}

	public sendAck(
		messageId: string,
		status: "DELIVERED" | "ACTIONED",
		technicianId = "TECH-01",
		clientNotes?: string,
	): boolean {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({
					type: "ACK",
					message_id: messageId,
					status,
					technician_id: technicianId,
					client_notes: clientNotes ?? null,
				}),
			);
			return true;
		}
		return false;
	}

	public disconnect() {
		this.isExplicitlyDisconnected = true;
		if (this.appStateSubscription) {
			this.appStateSubscription.remove();
			this.appStateSubscription = null;
		}
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		if (this.ws) {
			try {
				this.ws.close();
			} catch {}
			this.ws = null;
		}
		this.setStatus("DISCONNECTED");
	}
}

export const deviceWsClient = new DeviceWebSocketService();
