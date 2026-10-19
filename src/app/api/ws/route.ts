import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { receiveSocketMessage, registerSocket, unregisterSocket } from "@/modules/realtime/socket-handler";

export const runtime = "nodejs";

export function GET() {
  return experimental_upgradeWebSocket((ws) => {
    registerSocket(ws);
    ws.on("message", (data: WebSocketData) => void receiveSocketMessage(ws, data.toString()));
    const close = () => unregisterSocket(ws);
    ws.on("close", close);
    ws.on("error", close);
  });
}
