import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Next 16's detached TypeScript CLI output is not parseable in this environment;
    // `pnpm typecheck` and Next's compiler-API type pass remain enabled.
    useTypeScriptCli: false,
  },
  serverExternalPackages: ["ioredis", "ws"],
  outputFileTracingIncludes: {
    "/*": ["./src/modules/game/implementations/word-chain/data/**/*"],
  },
};

export default nextConfig;
