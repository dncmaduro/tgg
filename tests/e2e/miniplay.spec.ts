import { expect, test } from "@playwright/test";

test("two browser contexts can create, join, ready, play, and rematch", async ({ browser }) => {
  const playerA = await browser.newContext();
  const playerB = await browser.newContext();
  const a = await playerA.newPage();
  const b = await playerB.newPage();

  await a.goto("/");
  await a.getByPlaceholder("ví dụ: Mèo Lười").fill("Player A");
  await a.getByRole("button", { name: /tạo phòng mới/i }).click();
  await expect(a).toHaveURL(/\/room\/\d{6}$/);
  const code = (await a.locator("text=/^\\d{6}$/").first().textContent())?.trim();
  expect(code).toMatch(/^\d{6}$/);

  await b.goto(`/room/${code}`);
  await b.getByPlaceholder("Tên hiển thị").fill("Player B");
  await b.getByRole("button", { name: /tham gia phòng/i }).click();
  await expect(b.getByText("Player A")).toBeVisible();
  await expect(a.getByText("Player B")).toBeVisible();

  await a.getByRole("button", { name: /tôi đã sẵn sàng/i }).click();
  await b.getByRole("button", { name: /tôi đã sẵn sàng/i }).click();
  await a.getByRole("button", { name: /bắt đầu ván/i }).click();
  await expect(a.getByText(/Caro mini/)).toBeVisible();
  await expect(b.getByText(/Caro mini/)).toBeVisible();

  await a.getByRole("button", { name: "Ô 1" }).click();
  await b.getByRole("button", { name: "Ô 4" }).click();
  await a.getByRole("button", { name: "Ô 2" }).click();
  await b.getByRole("button", { name: "Ô 5" }).click();
  await a.getByRole("button", { name: "Ô 3" }).click();
  await expect(a.getByText(/thắng ván này/)).toBeVisible();
  await expect(b.getByText(/thắng ván này/)).toBeVisible();
  await a.getByRole("button", { name: /chơi lại/i }).click();
  await expect(a.getByText(/Đang chờ đồng đội/)).toBeVisible();

  await playerA.close();
  await playerB.close();
});
