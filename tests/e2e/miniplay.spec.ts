import { expect, test } from "@playwright/test";

function observeWebSocket(page: import("@playwright/test").Page, label: string): void {
  const format = (payload: unknown): string => {
    if (typeof payload === "string") return payload;
    if (payload instanceof Uint8Array) return new TextDecoder().decode(payload);
    try { return JSON.stringify(payload); } catch { return String(payload); }
  };
  page.on("websocket", (websocket) => {
    if (process.env.MINIPLAY_E2E_WS_DEBUG !== "1" || !(/\/(?:ws|api\/ws)$/.test(new URL(websocket.url()).pathname))) return;
    const log = (event: string, payload?: unknown) => {
      const suffix = payload === undefined ? "" : ` ${format(payload)}`;
      console.log(`[e2e ws ${label}] ${event}${suffix}`);
    };
    log("open", websocket.url());
    websocket.on("framesent", (payload) => log("sent", payload));
    websocket.on("framereceived", (payload) => log("received", payload));
    websocket.on("socketerror", (error) => log("error", error));
    websocket.on("close", () => log("close"));
  });
  if (process.env.MINIPLAY_E2E_WS_DEBUG === "1") {
    page.on("pageerror", (error) => console.log(`[e2e page ${label}] error ${error.message}`));
    page.on("console", (message) => console.log(`[e2e console ${label}] ${message.type()} ${message.text()}`));
  }
}

test("two browser contexts can create, join, ready, play, and rematch", async ({ browser }) => {
  const playerA = await browser.newContext();
  const playerB = await browser.newContext();
  const a = await playerA.newPage();
  const b = await playerB.newPage();
  if (process.env.MINIPLAY_E2E_WS_DEBUG === "1") {
    await a.addInitScript(() => window.localStorage.setItem("miniplay:debug-ws", "1"));
    await b.addInitScript(() => window.localStorage.setItem("miniplay:debug-ws", "1"));
  }
  observeWebSocket(a, "A");
  observeWebSocket(b, "B");

  await a.goto("/");
  await a.getByRole("button", { name: /tạo phòng/i }).click();
  await a.getByRole("dialog").getByLabel("Tên hiển thị").fill("Player A");
  await a.getByRole("dialog").getByRole("button", { name: /tiếp tục/i }).click();
  await expect(a).toHaveURL(/\/room\/\d{6}$/);
  const code = (await a.locator("text=/^\\d{6}$/").first().textContent())?.trim();
  expect(code).toMatch(/^\d{6}$/);

  await b.goto(`/room/${code}`);
  await b.getByRole("dialog").getByLabel("Tên hiển thị").fill("Player B");
  await b.getByRole("dialog").getByRole("button", { name: /tiếp tục/i }).click();
  await expect(b.getByText("Player A")).toBeVisible();
  await expect(a.getByText("Player B")).toBeVisible();

  await a.getByRole("button", { name: /^Sẵn sàng$/ }).click();
  await b.getByRole("button", { name: /^Sẵn sàng$/ }).click();
  await a.getByRole("button", { name: /^Bắt đầu$/ }).click();
  await expect(a.getByText(/Bạn là [XO]/)).toBeVisible();
  await expect(b.getByText(/Bạn là [XO]/)).toBeVisible();

  await a.getByRole("button", { name: "Ô 1" }).click();
  await b.getByRole("button", { name: "Ô 4" }).click();
  await a.getByRole("button", { name: "Ô 2" }).click();
  await b.getByRole("button", { name: "Ô 5" }).click();
  await a.getByRole("button", { name: "Ô 3" }).click();
  await expect(a.getByText(/thắng\.$/)).toBeVisible();
  await expect(b.getByText(/thắng\.$/)).toBeVisible();
  await expect(b.getByRole("button", { name: /chơi lại/i })).toHaveCount(0);
  await expect(b.getByText(/Chờ chủ phòng bắt đầu ván mới/)).toBeVisible();
  await a.getByRole("button", { name: /chơi lại/i }).click();
  await expect(a.getByRole("button", { name: /^Sẵn sàng$/ })).toBeVisible();

  await playerA.close();
  await playerB.close();
});
