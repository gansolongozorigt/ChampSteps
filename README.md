# ChampStep — Phase 1

Children's competition achievement tracker. This first phase ships the two flagship views requested:

- `TimelineDashboard` — vertical, journal-style timeline grouped by month, with summary cards and category filters.
- `AddAchievementForm` — 4-step form (Basics → Award & story → Photos → Review) with client-side image compression baked in.

## Stack

- **React 18 + Vite + TypeScript** — strict mode, JSX runtime.
- **Tailwind CSS** — warm `stone-*` palette + serif accent for "journal" feel.
- **Firebase (stubbed)** — `src/lib/firebase.ts` contains the Auth/Firestore/Storage init scaffold and an example `createAchievement(childId, draft)` you can drop in once your `.env` is configured.

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL — the demo `App.tsx` seeds 4 sample achievements for a fictional child "Tuya" so the timeline renders immediately.

## Project layout

```
src/
  types/index.ts                 ← User, Child, Achievement, AchievementDraft
  utils/image.ts                 ← compressImage(s) helper (canvas + JPEG re-encode)
  utils/format.ts                ← formatDate, groupByMonth, category/award styles
  components/AddAchievementForm.tsx
  components/TimelineDashboard.tsx
  lib/firebase.ts                ← init stub + commented createAchievement() example
  App.tsx                        ← demo wiring (in-memory state)
  main.tsx, index.css            ← Vite entry + Tailwind directives
```

## Wiring to Firebase (next step)

1. `npm i firebase` (already in `package.json`).
2. Fill `firebaseConfig` in `src/lib/firebase.ts`, uncomment the imports.
3. Replace the `inMemoryAdd` callback in `App.tsx` with `createAchievement(demoChild.childId, draft)`.
4. Subscribe to the achievements collection with `onSnapshot` and feed the result into `TimelineDashboard`.

## What's intentionally deferred to Phase 2

- Firebase Auth provider + protected routes.
- Portfolio Builder + jsPDF template (top-5 grid of awards w/ photos).
- Subscription / paywall page and `subscriptionStatus` gating.
- PWA manifest + service worker (Vite PWA plugin).

## Mongolian summary / Монгол хураангуй

Энэ хувилбарт **Хяналтын дашбоард** ба **Амжилт нэмэх форм** хоёрыг React + TypeScript + Tailwind дээр бэлэн болгосон. `types/index.ts`-д Schema-г, `utils/image.ts`-д Firebase Storage-д ачаалахын өмнө зургийг хавсаргахдаа автоматаар жижигрүүлдэг функц орсон. Firebase холболтыг `src/lib/firebase.ts` дээр тайлбартай загвар хэлбэрээр бичсэн — config-оо оруулаад `App.tsx` дотор `inMemoryAdd`-ыг `createAchievement`-аар сольж ажиллуулна.
