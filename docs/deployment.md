# Deploy MiniPlay to Vercel + Upstash

Mục tiêu của cấu hình này là Vercel Hobby + Upstash Redis Free, không thêm dịch vụ trả phí. Repo đã chuẩn bị code để deploy nhưng chưa được deploy từ môi trường này: không có Vercel CLI/authentication hoặc project liên kết trong checkout.

## Trạng thái triển khai

Phân biệt ba trạng thái sau:

- **Code ready for deployment:** đạt sau khi `typecheck`, `lint`, unit test, build và E2E local pass.
- **Deployment successful:** chỉ đạt sau khi Vercel trả về một deployment URL thành công.
- **Production multiplayer verified:** chỉ đạt sau khi smoke test trên URL thật, bao gồm reconnect; hai browser cùng kết nối chưa đủ để chứng minh cross-instance relay.

Checkout hiện chỉ đạt trạng thái đầu tiên. Chưa có production URL để báo cáo.

## Cấu hình đã có trong repo

- `vercel.json` bật Fluid Compute: `{ "fluid": true }`.
- `pnpm build` là build command; Vercel nhận diện Next.js từ `package.json` và `pnpm-lock.yaml`.
- Các route HTTP và `/api/ws` dùng Node.js runtime.
- `@vercel/functions` được ghim ở nhánh `3.10+` và route dùng `upgradeWebSocket()`.
- `next.config.ts` chỉ tắt detached TypeScript CLI của Next 16 vì output của CLI đó không parse được trong môi trường này; không tắt type checking. `pnpm typecheck` và bước TypeScript của `pnpm build` vẫn bắt buộc phải pass.
- Client dùng `/api/ws` khi chạy trên host production và tự chọn `wss://` khi trang dùng HTTPS.
- Local vẫn dùng adapter native `/ws`; không đổi adapter này thành `/api/ws`.
- Room state nằm trong Redis ở production; memory store chỉ được phép cho development hoặc Playwright local với cả `MINIPLAY_ALLOW_MEMORY=true` và `MINIPLAY_LOCAL_E2E=true`.

Vercel hiện hỗ trợ WebSockets trên mọi plan. Một socket được ghim vào một Function instance; Fluid Compute cho phép một instance xử lý nhiều socket. Khi Function đạt giới hạn duration, client phải reconnect và subscribe lại. Đây là lý do Redis bắt buộc cho room state, presence và relay giữa instance. Xem [Vercel WebSockets](https://vercel.com/docs/functions/websockets), [Next.js `upgradeWebSocket`](https://vercel.com/docs/functions/websockets#next-js), và [Fluid Compute](https://vercel.com/docs/fluid-compute).

## 1. Tạo Upstash Redis Free

1. Tạo một database Upstash Redis Free.
2. Chọn primary region gần region Vercel dự kiến nhất. Với người chơi ở Việt Nam, ưu tiên Singapore nếu cả hai bảng điều khiển đều cung cấp lựa chọn đó; kiểm tra lại latency thực tế.
3. Trong **Connect**, chọn **TCP**, không chọn REST.
4. Copy connection string có dạng:

```env
REDIS_URL=rediss://default:YOUR_TOKEN@YOUR_ENDPOINT:6379
```

Ứng dụng dùng `ioredis` và Redis Streams với `XREAD BLOCK`, nên cần Redis TCP/TLS URL. Upstash mô tả `rediss://` là TLS và connection string TCP tương thích với ioredis; REST URL và REST token là credential cho HTTP client khác. Xem [Upstash ioredis/TCP example](https://upstash.com/docs/redis/quickstarts/express) và [Upstash TCP vs REST compatibility](https://upstash.com/docs/redis/overall/compatibility).

Free tier hiện được Upstash niêm yết là 500K commands/tháng và 256 MB data. MiniPlay giảm lưu lượng bằng một primary connection dùng lại, relay connection riêng chỉ mở khi có socket đang subscribe, `XREAD BLOCK` 30 giây thay vì polling nhanh, TTL 12 giờ cho room và `MAXLEN ~ 5000` cho Redis Stream. Xem [Upstash Redis pricing](https://upstash.com/pricing/redis). Vẫn cần theo dõi usage trong console; không bật Pay as You Go hoặc thêm payment method nếu mục tiêu vẫn là 0 đồng/tháng.

## 2. Tạo Vercel Project

### Dashboard

1. Import repository vào Vercel và chọn framework preset **Next.js**.
2. Giữ root directory là thư mục chứa `package.json`.
3. Install command: để Vercel tự nhận pnpm từ `packageManager`, hoặc đặt `pnpm install --frozen-lockfile`.
4. Build command: `pnpm build`.
5. Chọn Node.js 20.x trở lên, phù hợp với yêu cầu Next.js/package hiện tại.
6. Bật **Fluid Compute**. Repo đã khai báo `fluid: true` trong `vercel.json`; vẫn kiểm tra lại setting của project sau khi import.
7. Chọn Function region gần Upstash primary region nhất. Region Vercel và region Upstash nên cùng khu vực; không thêm region trả phí.
8. Thêm Environment Variable `REDIS_URL` cho **Production** (và Preview nếu muốn test preview). Dán TCP/TLS URL; không thêm `UPSTASH_REDIS_REST_URL` hoặc `UPSTASH_REDIS_REST_TOKEN` vì code không đọc chúng.
9. Không đặt `MINIPLAY_ALLOW_MEMORY=true`, `MINIPLAY_LOCAL_E2E=true`, hay `NEXT_PUBLIC_*` chứa secret trên Vercel.

### CLI

Chỉ chạy các lệnh này sau khi đã đăng nhập Vercel bằng tài khoản của bạn. Không gửi token qua chat và không giả định CLI đã được authenticate:

```bash
pnpm install --frozen-lockfile
pnpm build
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env add REDIS_URL production
npx vercel@latest --prod
```

Khi CLI hỏi giá trị `REDIS_URL`, dán giá trị trực tiếp vào prompt của CLI; không ghi vào file hoặc commit vào Git. Nếu project có Preview deployment, lặp lại `env add REDIS_URL preview` khi cần.

## 3. Health và WebSocket smoke test

Sau khi Vercel trả deployment URL, chạy:

```bash
curl -i https://YOUR_DOMAIN/api/health
```

Kỳ vọng HTTP `200` và JSON tương tự:

```json
{"ok":true,"storage":"redis","productionReady":true,"realtime":"websocket"}
```

HTTP `503` với `REDIS_REQUIRED` nghĩa là chưa cấu hình `REDIS_URL`; `REDIS_UNAVAILABLE` nghĩa là URL có nhưng Redis chưa reachable. Cả hai trường hợp đều là deployment chưa sẵn sàng, không fallback sang memory.

Kiểm tra WebSocket bằng cách mở trang production trong DevTools hoặc hai browser khác nhau và xác nhận connection tới:

```text
wss://YOUR_DOMAIN/api/ws
```

Nếu handshake lỗi, xem Vercel Function logs cho `/api/ws`, kiểm tra Fluid Compute, runtime Node.js và `REDIS_URL`. Vercel áp dụng routing/security/rate limits cho request Upgrade trước khi socket được mở; rate limit application-level của MiniPlay chỉ là best-effort theo Function instance.

## 4. Multiplayer production smoke test

Thực hiện trên URL thật, với hai thiết bị hoặc hai browser profile:

1. Player A nhập nickname và tạo Tic-Tac-Toe.
2. Player B nhập mã phòng từ thiết bị khác.
3. Hai người thấy cùng danh sách player.
4. Cả hai bấm Ready; host bấm Start.
5. Hai người lần lượt đánh một chuỗi hợp lệ.
6. Cả hai nhận cùng revision, trạng thái thắng/thua và board.
7. Host bấm Rematch; room trở lại `WAITING`.
8. Reload Player A; identity trong `sessionStorage` phải reconnect mà không tạo player trùng và game state vẫn còn.
9. Ngắt mạng Player A trong thời gian ngắn, để Player B tiếp tục, rồi khôi phục mạng và xác nhận A reconnect/resubscribe.
10. Tạo phòng B song song với phòng A; thực hiện một action ở mỗi phòng và xác nhận không nhận event chéo.

Để kiểm tra Redis relay giữa hai Function instance, cần một môi trường có thể chủ động làm hai socket đi tới hai instance khác nhau hoặc có evidence từ logs/observability. Hai browser cùng kết nối thành công không tự chứng minh điều đó. Nếu không tạo được điều kiện này, ghi nhận **cross-instance relay chưa được xác minh** thay vì đánh dấu production multiplayer verified.

## 5. Logs và giới hạn

Logs production chỉ ghi metadata tối thiểu: WebSocket connection id mở/đóng, Redis connection error/reconnect, room created, game started/ended và unexpected handler errors. Không log credential, Redis URL/token hoặc toàn bộ game state.

Ứng dụng có thêm giới hạn frame WebSocket 8 KiB, validate code 6 chữ số và identity, rate-limit best-effort cho create/join theo IP trong một Function instance. Vercel Firewall/rate limiting vẫn là lớp phù hợp nếu app public bị spam; không thêm Redis counter cho rate-limit vì sẽ tiêu tốn commands của Free tier.

Không expose `REDIS_URL` lên client. `.gitignore` loại trừ `.env*`, `.vercel` và các file secret; chỉ `.env.example` được theo dõi trong Git.

## 6. Chạy regression trước mỗi deploy

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` tự chạy local production-shaped server với `/ws` và memory adapter được bật bằng cặp biến test riêng. Điều đó không thay thế smoke test trên Vercel `/api/ws` với Redis thật.
