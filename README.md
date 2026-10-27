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

## Changelog

- 2026-10-26: Шинэ эцэг эхийн эхний алхмууд: эхний хүүхдийн дараа "Дараагийн тэмцээн хэзээ вэ?" (GoalForm, алгасаж болно) → "Өнөөдрийн бэлтгэлээ тэмдэглэх үү?"; "Эхлэх алхмууд" карт (дашбоард + Өнөөдөр; хүүхэд, зорилго, бэлтгэл, амжилт, сануулга — зөвхөн ✓, Хаах; өгөгдлөөс тооцно, src/lib/onboarding.ts); эхний бэлтгэлийн дараа нэг удаа "Орой 20:00-д сануулах уу?"; бэлтгэлгүй эцэг эх Өнөөдөр табаас эхэлнэ. Багшид өөрчлөлтгүй. Metrics: эхний алхмуудын funnel (хэрэглэгчээр). Мобайлын "Багцаа ахиулах" доод мөр Үнэгүй багцад зөвхөн хязгаарт ойртоход (≥25/30) гарна (src/lib/upgradeBar.ts), FAB мөрийн дээр байрлана; RU 375px header/доод цэс засагдсан (nav.short.*).
- 2026-10-26: QPay callback ирэхгүй үеийн нөөц зам: `/api/qpay/status` pending захиалга 10+ секунд болсон бол QPay payment/check-ээр давхар асууж, төлөгдсөн бол callback-тэй ижил `activateSubscription`-ийг дуудна (idempotent, нэг захиалгад 5 сек-д ≤1 QPay дуудлага, `payments.lastCheckAt`). Metrics эзэмшигч/админ бүртгэлийг `METRICS_EXCLUDE`-ээр хасна.
- 2026-10-21: PDF хавсралт сонголттой болсон ("Хавсралт — зураг бүрийг бүтэн хуудсаар", анхдагч унтраалттай, хөтөч санана): унтраалттай үед хавсралтын хуудас, ↗ тэмдэг, холбоос байхгүй, карт дээрх зургууд хэвээр. Бэлтгэлийн тэмдэглэл "· 10-16 · 45 мин" + 3 мөр хүртэл бүтнээр, hanging indent.
- 2026-10-21: Хүүхдийн нас төрсөн огнооноос автоматаар (Улаанбаатарын огноогоор): дашбоардын толгой, PDF 3 загвар, AI зөвлөмжид "12 настай · bio". Bio-ийн эхэнд гараар бичсэн нас ("11 настай · …") зөвхөн харуулахдаа хасагдана, хадгалсан өгөгдөл өөрчлөгдөхгүй. Профайл засварлагчид насны тусламж мөр, bio-д нас бичвэл санамж.
- 2026-10-14: Зорилго / тэмцээн (goals коллекц, rules): "Өнөөдөр" дээр countdown карт, бэлтгэл зорилгод холбогдоно (practiceLogs.goalId), тэмцээний өдрийн урамшууллын дэлгэц, "Үр дүн бичих" → амжилт (achievements.prep: бэлтгэлийн статистик картанд, PDF 3 загварт, экспортод), сануулга зорилгын нэртэй + тэмцээний өглөөний cron 08:00 УБ. Үнэгүй: хүүхэд бүрт 1 идэвхтэй зорилго.
- 2026-10-14: "Өнөөдөр" дэлгэц (/today: хурдан бэлтгэлийн бичлэг, streak, 7 хоногийн зураас), офлайн бичилт + banner, нүүр дэлгэцэнд суулгах заавар (iOS/Android), push сануулга (FCM, өдөр бүр 20:00 УБ, тэмцээний өмнөх өдөр; docs/ADMIN.md §8), manifest shortcuts.
- 2026-10-13: Хэрэглэгчийн өгөгдлийн экспорт (JSON/ZIP); Firestore scheduled backup + сарын offsite нөөцлөлт (docs/BACKUP.md).
- 2026-10-13: PDF 3 загвар (Албан ёсны / Хүрээтэй / Портфолио), UI-д emoji байхгүй.
- 2026-10-12: Хүүхдийн бүртгэл болон өөрийн бүртгэлийг аппаас устгах боломж (сервер талын бүрэн устгал: `/api/child/delete`, `/api/account/delete`). Шинэ эцэг эхэд "Хүүхэд" нэртэй default хүүхэд автоматаар үүсгэхээ больсон: хоосон төлөв + анхны удаа "Хүүхэд нэмэх" модал (нэр, төрсөн огноо заавал).
- 2026-10-12: Ногоон брэндийн дизайн шинэчлэл production-д (docs/BRAND.md).
