import { expect, test } from "@playwright/test";

test("two browser contexts connect to FPS Arena and render the shared arena", async ({ browser }) => {
  test.setTimeout(45_000);
  const playerA = await browser.newContext();
  const playerB = await browser.newContext();
  const a = await playerA.newPage();
  const b = await playerB.newPage();
  a.on("console", (message) => { if (process.env.MINIPLAY_E2E_WS_DEBUG === "1") console.log(`[fps A] ${message.type()} ${message.text()}`); });
  b.on("console", (message) => { if (process.env.MINIPLAY_E2E_WS_DEBUG === "1") console.log(`[fps B] ${message.type()} ${message.text()}`); });
  a.on("pageerror", (error) => console.log(`[fps A error] ${error.message}`));
  b.on("pageerror", (error) => console.log(`[fps B error] ${error.message}`));

  await a.goto("/");
  await a.getByRole("article").filter({ hasText: "FPS Arena" }).getByRole("button", { name: /tạo phòng/i }).click();
  await a.getByRole("dialog").getByLabel("Tên hiển thị").fill("Player A");
  await a.getByRole("dialog").getByRole("button", { name: /tiếp tục/i }).click();
  await expect(a).toHaveURL(/\/room\/\d{6}$/);
  const code = (await a.locator("text=/^\\d{6}$/").first().textContent())?.trim();
  expect(code).toMatch(/^\d{6}$/);

  await b.goto(`/room/${code}`);
  await b.getByRole("dialog").getByLabel("Tên hiển thị").fill("Player B");
  await b.getByRole("dialog").getByRole("button", { name: /tiếp tục/i }).click();
  await expect(a.getByText("Player B")).toBeVisible();
  await expect(b.getByText("Player A")).toBeVisible();

  await a.getByRole("button", { name: /^Sẵn sàng$/ }).click();
  await b.getByRole("button", { name: /^Sẵn sàng$/ }).click();
  await a.getByRole("button", { name: /^Bắt đầu$/ }).click();

  await expect(a.locator("canvas")).toBeVisible();
  await expect(b.locator("canvas")).toBeVisible();
  if (process.env.MINIPLAY_E2E_WS_DEBUG === "1") console.log(`[fps body A] ${await a.locator("body").innerText()}`);
  if (process.env.MINIPLAY_E2E_WS_DEBUG === "1") console.log(`[fps body B] ${await b.locator("body").innerText()}`);
  await expect(a.getByText(/WebRTC 1\/1/)).toBeVisible({ timeout: 15_000 });
  await expect(b.getByText(/WebRTC 1\/1/)).toBeVisible({ timeout: 15_000 });
  await expect(a.getByText("ASSAULT RIFLE", { exact: true })).toBeVisible();
  await expect(b.getByText("ASSAULT RIFLE", { exact: true })).toBeVisible();
  await a.keyboard.down("Tab");
  await expect(a.getByText("Player B", { exact: true })).toBeVisible({ timeout: 15_000 });
  await a.keyboard.up("Tab");
  await b.keyboard.down("Tab");
  await expect(b.getByText("Player A", { exact: true })).toBeVisible({ timeout: 15_000 });
  await b.keyboard.up("Tab");

  await a.locator("canvas").click();
  await a.keyboard.down("w");
  await a.waitForTimeout(250);
  await a.keyboard.up("w");

  await playerA.close();
  await playerB.close();
});
