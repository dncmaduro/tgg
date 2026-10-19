import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { receiveSocketMessage, registerSocket, unregisterSocket } from "@/modules/realtime/socket-handler";
import { handleLocalApi } from "@/server/local-api";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler();
  const server = createServer((request, response) => {
    void (async () => {
      if (await handleLocalApi(request, response)) return;
      void handle(request, response, parse(request.url ?? "", true));
    })();
  });

  const websocketServer = new WebSocketServer({ server, path: "/api/ws" });
  websocketServer.on("connection", (websocket) => {
    registerSocket(websocket);
    websocket.on("message", (data) => void receiveSocketMessage(websocket, data.toString()));
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      unregisterSocket(websocket);
    };
    websocket.on("close", close);
    websocket.on("error", close);
  });

  server.on("upgrade", (request, socket, head) => {
    if (parse(request.url ?? "").pathname === "/api/ws") return;
    if (dev) upgradeHandler(request, socket, head);
    else socket.destroy();
  });

  server.listen(port, hostname, () => {
    console.log(`> MiniPlay ready on http://localhost:${port}`);
  });
});
