# Deploy to Vercel

1. Create an Upstash Redis database and connect it to the Vercel project. The current Vercel WebSocket guide uses `REDIS_URL`; configure the same variable locally and in production.
2. Push this repository to GitHub and import it into Vercel, or use the CLI:

```bash
pnpm install
pnpm build
npx vercel@latest link
npx vercel@latest env add REDIS_URL
npx vercel@latest --prod
```

3. Test the deployed URL in two separate browser tabs. Use one nickname per tab, create a room in tab A, join with the code in tab B, ready both players, and play a full match.

## Important Vercel WebSocket notes

The `@vercel/functions` upgrade API is experimental and must be tested with the Vercel CLI/runtime. Plain `next dev` does not provide the Vercel upgrade hook; local development in this repository uses the native `ws` adapter instead. Vercel can close long-lived function connections at the function duration limit, so the browser reconnects and resubscribes automatically.

Redis is not optional for a multi-instance deployment. Without it, local development is intentionally single-process only; production configuration fails instead of pretending that memory is shared.

`MINIPLAY_ALLOW_MEMORY=true` exists only for local Playwright verification and should never be set on Vercel.
