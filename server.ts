import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, type RawData } from "ws";
import { receiveSocketMessage, registerSocket, unregisterSocket } from "@/modules/realtime/socket-handler";
import { MAX_WEBSOCKET_MESSAGE_BYTES } from "@/modules/realtime/protocol";
import { handleLocalApi } from "@/server/local-api";

const dev = process.env.NODE_ENV !== "production";
const hostname = "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);

function debugWebSocket(message: string, ...values: unknown[]): void {
  if (process.env.MINIPLAY_WS_DEBUG === "1") console.error(`[MiniPlay ws] ${message}`, ...values);
}

function rawDataBytes(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((total, part) => total + part.byteLength, 0);
  if (typeof data === "string") return Buffer.byteLength(data);
  return data.byteLength;
}

const app = next({ dev, hostname, port });

void app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const server = createServer((request, response) => {
    void (async () => {
      if (await handleLocalApi(request, response)) return;
      void handle(request, response, parse(request.url ?? "", true));
    })();
  });

  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES });
  websocketServer.on("connection", (websocket) => {
    debugWebSocket("connection");
    registerSocket(websocket);
    websocket.on("message", (data) => {
      debugWebSocket("server received frame", { bytes: rawDataBytes(data) });
      void receiveSocketMessage(websocket, data.toString());
    });
    let closed = false;
    const close = (code?: number, reason?: Buffer) => {
      if (closed) return;
      closed = true;
      debugWebSocket("connection closed", { code, reason: reason?.toString() });
      unregisterSocket(websocket);
    };
    websocket.on("close", close);
    websocket.on("error", (error) => {
      debugWebSocket("connection error", { message: error.message });
      close();
    });
  });

  const upgradeHandler = dev ? app.getUpgradeHandler() : undefined;
  server.on("upgrade", (request, socket, head) => {
    if (parse(request.url ?? "").pathname === "/ws") {
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request);
      });
      return;
    }
    if (upgradeHandler) upgradeHandler(request, socket, head);
    else socket.destroy();
  });

  server.listen(port, hostname, () => {
    console.log(`> MiniPlay ready on http://localhost:${port}`);
  });
});
