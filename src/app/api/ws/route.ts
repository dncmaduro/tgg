import { upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { receiveSocketMessage, registerSocket, unregisterSocket } from "@/modules/realtime/socket-handler";
import { MAX_WEBSOCKET_MESSAGE_BYTES } from "@/modules/realtime/protocol";

export const runtime = "nodejs";

export function GET() {
  return upgradeWebSocket((ws) => {
    registerSocket(ws);
    ws.on("message", (data: WebSocketData) => void receiveSocketMessage(ws, data.toString()));
    const close = () => unregisterSocket(ws);
    ws.on("close", close);
    ws.on("error", close);
  }, { maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES });
}
