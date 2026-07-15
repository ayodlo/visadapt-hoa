#!/usr/bin/env node
// Works around npm/cli#4828: inside an npm workspace, `npm install`/`npm ci`
// on Linux can silently drop a valid, correctly platform-gated
// optionalDependency. Already hit and fixed once for rolldown's native
// binding in .github/workflows/ci.yml — this is the same bug, just for
// @tailwindcss/oxide's Linux binary, and it only surfaces on a real `next
// build` (Tailwind's PostCSS plugin loads the native binding to process
// globals.css), which CI never runs (it only does tests/lint/tsc). Vercel's
// build does run `next build`, so this failed there with:
//   "Cannot find module '@tailwindcss/oxide-linux-x64-gnu'"
// See DEVLOG 2026-07-15 for the full reproduction.
const { execSync } = require('node:child_process');

if (process.platform !== 'linux' || process.arch !== 'x64') process.exit(0);

const pkg = '@tailwindcss/oxide-linux-x64-gnu';

try {
  require.resolve(pkg);
  process.exit(0);
} catch {
  // Not installed — fall through and install it explicitly below.
}

const version = require('@tailwindcss/oxide/package.json').version;
console.log(`Working around npm/cli#4828: installing ${pkg}@${version}`);
execSync(`npm install ${pkg}@${version} --no-save --no-audit --no-fund`, { stdio: 'inherit' });
