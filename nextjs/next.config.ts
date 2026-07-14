import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root became an npm workspace (root package.json +
  // package-lock.json) in the mobile-app monorepo restructure. Without this,
  // Turbopack auto-infers the workspace root as the repo root instead of
  // this directory, which breaks module resolution for module imports in
  // freshly-compiled route chunks (e.g. `Cannot find module 'zod'`) because
  // it resolves against the wrong node_modules tree.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
