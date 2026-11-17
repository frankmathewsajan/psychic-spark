import json
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")


class WebSocketManager:
    def __init__(self):
        self.device_sockets: dict[str, WebSocket] = {}
        self.admin_sockets: list[WebSocket] = []

    async def connect_device(self, device_id: str, websocket: WebSocket):
        await websocket.accept()
        self.device_sockets[device_id] = websocket
        logger.info("Device connected over WS: %s", device_id)
        await self.broadcast_to_admins({"type": "DEVICE_PRESENCE", "device_id": device_id, "is_online": True})

    def disconnect_device(self, device_id: str):
        if device_id in self.device_sockets:
            del self.device_sockets[device_id]
            logger.info("Device disconnected from WS: %s", device_id)

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_sockets.append(websocket)

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_sockets:
            self.admin_sockets.remove(websocket)

    async def broadcast_to_admins(self, message: dict[str, Any]):
        dead = []
        for ws in self.admin_sockets:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_admin(ws)

    async def send_to_device(self, device_id: str, message: dict[str, Any]) -> bool:
        ws = self.device_sockets.get(device_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message))
                return True
            except Exception:
                self.disconnect_device(device_id)
        return False

    def is_device_online(self, device_id: str) -> bool:
        return device_id in self.device_sockets


ws_manager = WebSocketManager()
