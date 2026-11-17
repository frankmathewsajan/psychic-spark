import type { SQLiteDatabase } from "expo-sqlite";
import {
	getAppVersion,
	getDeviceModel,
	getOrCreateDeviceId,
	upsertClientMessage,
} from "@/core/db/repository";
import { logger } from "@/core/logger";
import type { ClientMessage } from "@/core/types/inspection";

export interface DeviceTelemetry {
	lat: number;
	lon: number;
	battery?: number | null;
	technician_id: string;
}

class DeviceWebSocketService {
	private ws: WebSocket | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private currentUrl = "";
	private deviceId = "";
	private onMessageCallback: ((msg: ClientMessage) => void) | null = null;

	public init(
		db: SQLiteDatabase,
		gatewayUrl: string,
		technicianId = "TECH-01",
		onMessage?: (msg: ClientMessage) => void,
	) {
		this.onMessageCallback = onMessage ?? null;
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
		const wsBase = gatewayUrl.trim().replace(/^http/, "ws").replace(/\/+$/, "");
		const targetUrl = `${wsBase}/api/v1/ws/device/${this.deviceId}`;

		if (this.ws && this.currentUrl === targetUrl) return;
		this.disconnect();
		this.currentUrl = targetUrl;

		try {
			const socket = new WebSocket(targetUrl);
			this.ws = socket;

			socket.onopen = () => {
				logger.info("DeviceWS", `Connected to ${targetUrl}`);
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
					}
				} catch (err) {
					logger.warn("DeviceWS", "Failed to parse incoming WS message", err);
				}
			};

			socket.onclose = () => {
				if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
			};

			socket.onerror = () => {
				if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
			};
		} catch (e) {
			logger.warn("DeviceWS", "Connection failed", e);
		}
	}

	public sendTelemetry(
		technicianId = "TECH-01",
		lat = 19.076,
		lon = 72.8777,
		battery = 0.92,
	) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({
					type: "TELEMETRY",
					lat,
					lon,
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
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		if (this.ws) {
			try {
				this.ws.close();
			} catch {}
			this.ws = null;
		}
	}
}

export const deviceWsClient = new DeviceWebSocketService();
