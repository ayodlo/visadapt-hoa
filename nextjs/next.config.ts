import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-tools portal in this Next version intercepts pointer events across the
  // viewport, so Playwright resolves a button, finds it visible and stable, then
  // times out clicking it (see the theme toggle at fixed top-4 right-4, nowhere
  // near the indicator's bottom-left default position).
  //
  // Disabled only while the e2e suite drives the dev server — a plain `npm run dev`
  // keeps the indicator. Per the devIndicators docs, compile and runtime errors are
  // still surfaced with this off, so nothing is hidden from the test run.
  ...(process.env.E2E === '1' ? { devIndicators: false as const } : {}),
};

export default nextConfig;
