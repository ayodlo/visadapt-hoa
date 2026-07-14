// EXPO_PUBLIC_-prefixed vars are inlined into the client bundle at build time,
// analogous to Next.js's NEXT_PUBLIC_ convention on the web app.
// Set in mobile/.env (see .env.example) — Expo Go on a physical device needs
// the dev machine's LAN IP, not localhost; Android emulator needs 10.0.2.2.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
