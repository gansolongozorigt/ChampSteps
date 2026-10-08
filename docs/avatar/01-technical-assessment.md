# Аватар — техникийн үнэлгээ (Үе шат 0)

Огноо: 2026-10-08 · Branch: `avatar-prototype` · Эх сурвалж: репогийн бодит код (файл:мөр заасан), Rive-ийн албан ёсны баримт, npm registry.

## 1. Аватар орох цэгүүд

**Tab бүтэц.** Router байхгүй: `src/App.tsx:56` `type NavSection = "achievements" | "practice" | "reflection" | "coach" | "pdf" | "about" | "terms" | "subscription"`, state `activeSection` (`App.tsx:98`), `<main>` дотор `activeSection === "..."` нөхцөлөөр хэсэг бүр рендэрлэгдэнэ (`App.tsx:656–725`). Амжилтын дэлгэц = `<TimelineDashboard>` (`App.tsx:658`), толгой хэсэг нь `src/components/TimelineDashboard.tsx:132–163` (аватар зураг/үсэг + "Тэмдэглэл" + "{name}-ийн амжилтууд" + bio). Аватарын байгалийн байрлал: энэ header-ийн доор, `AchievementSummary`-ийн дээр (`TimelineDashboard.tsx:164`).

**Child сонголт.** `children: Child[]` + `activeChildIdx` (`App.tsx:95–96`), `const child = children[activeChildIdx]` (`App.tsx:122`). Sidebar товч `setActiveChildIdx(i)` (`App.tsx:583`). Хүүхэд солиход `TimelineDashboard` key-гүй тул дотоод state үлддэг; аватарыг `key={child.childId}`-тэй байрлуулах шаардлагатай (AI карт дээр 724b228a-д ижил засвар хийсэн).

**children doc, birthDate.** `src/types/index.ts` `Child.birthDate: string // YYYY-MM-DD`. Оруулах талбар `ChildProfileEditor.tsx:138` `<input type="date">` → ISO `YYYY-MM-DD`. Default хоосон мөр: `App.tsx:63` (`makeInitialChild`), `App.tsx:267` (нэмэх үед), `firebase.ts:240,261,665` `birthDate ?? ""`. Насны tier (reference/age-tiers.jpg: 7–10 / 11–14 / 15–18) тооцохдоо хоосон утгыг "тодорхойгүй" гэж үзэх ёстой; `api/_lib/aiInsight.ts` `childAge()` яг энэ форматыг аль хэдийн задалдаг.

**Dev маршрут.** Router байхгүй тул `/dev/avatar`-ийг `src/main.tsx`-д `location.pathname` шалгаж, зөвхөн `import.meta.env.DEV || import.meta.env.VITE_AVATAR_DEV === "1"` үед dynamic import-оор ачаална (production build-д chunk үүсэхгүй). Vite dev сервер болон `vercel.json` rewrite (`/((?!api/).*)` → `/index.html`) хоёулаа энэ замыг index.html руу буулгана.

## 2. Event гарах цэгүүд

Бичилт бүгд `App.tsx`-ийн handler-уудад төвлөрсөн; hook-ууд зөвхөн уншдаг (`onSnapshot`).

| Event | Амжилттай бичсэний дараах цэг | Firestore функц |
|---|---|---|
| `practice:added` | `App.tsx:296` `handleAddPracticeLog` — `await createPracticeLog(...)` амжилтын дараа (`App.tsx:299`); offline: `addLocalLog` (`App.tsx:303`) | `src/lib/firebase.ts:503` |
| `achievement:added` | `App.tsx:189` `handleAddAchievement` — `await createAchievement(...)` дараа `setToast(success)` (`App.tsx:198–200`); offline: `addLocal` (`App.tsx:222`) | `src/lib/firebase.ts:398` |
| reflection (одоогоор event биш) | `App.tsx:306` `handleAddReflection` | `src/lib/firebase.ts:541` |
| `app:open` | `Dashboard` mount (`App.tsx:132` children ачаалах effect-ийн дараа) | — |
| `inactive:3d` | `usePracticeLogs` (`src/hooks/usePracticeLogs.ts:38` subscribe) → `logs` ирэхэд client дээр `max(date)`-ийг өнөөдөртэй харьцуулна | — |
| `streak:milestone`, `tier:grow` | Одоогоор тооцоолол байхгүй; `practiceLogs.date` дараалал (streak) ба `users.subscriptionTier` өөрчлөлт (`lib/auth.tsx` `subscription`) эх сурвалж болно | — |

Унших hook-ууд: `useAchievements.ts:59`, `usePracticeLogs.ts:38`, `useReflections.ts:47`. Багшийн горимд (`readOnly`) бичих handler дуудагддаггүй тул event гарахгүй.

## 3. Rive React runtime vs SVG/CSS

**Rive (баримт/registry, 2026-10-08):** `@rive-app/react-canvas` 4.36.0 ба `@rive-app/react-webgl2` 4.36.0 (~48 KB wrapper) + runtime `@rive-app/canvas` 2.44.0 (unpacked 5.3 MB, WASM ~ зарим зуун KB download) эсвэл `@rive-app/canvas-lite` 2.44.0. Боломж: state machine (`useRive({ stateMachines })`, `useStateMachineInput`), data binding (`useViewModel`, `useViewModelInstance`, `useViewModelInstanceNumber/String/Boolean/Enum/Trigger/Color`, `useViewModelInstanceImage`, `useViewModelInstanceFont`, `useViewModelInstanceList`, `useViewModelInstanceArtboard`, `autoBind: true`), runtime image swap (`assetLoader(asset, bytes)` + `asset.isImage`, мөн data-binding image property), reduced-motion-ийн жишээ. Энэ бүгд **rig хийсэн `.riv` файл** шаардана: одоогийн asset нь 6 ширхэг AI-гаар үүсгэсэн бүтэн PNG (parts/ хоосон, character-sheet-ийн "Modular Parts" зөвхөн зураг) тул Rive-д оруулах зүйл одоогоор байхгүй.

**SVG/CSS (одоо):** 6 webp + crossfade + CSS keyframes. Хамаарал 0, ~120 KB зураг, prefers-reduced-motion-д CSS-ээр унтардаг. Хязгаар: хоорондын шилжилт нь crossfade, биеийн хэсэг тусдаа хөдлөхгүй, хувцас/үс солих бол шинэ зураг бүр.

**Хожим бодит rig-д:** Rive. Шалтгаан: (1) нэг `.riv`-д idle/wave/.../sleep state machine + blend, 6 PNG-ээс бага хэмжээтэй; (2) хувцас, өнгө, насны tier-ийг data binding (enum/image/color)-оор солино, зураг дахин үүсгэхгүй; (3) `AvatarState`/`AvatarEvent` интерфэйсийг одоо тогтоож байгаа тул `Avatar.tsx`-ийн дотор талыг л Rive-ээр солино, дуудагч код өөрчлөгдөхгүй. Нөхцөл: дизайнер parts-ийг тусад нь (head/torso/arms/legs/ball) rig-д бэлтгэнэ; runtime WASM-ийг lazy ачаална (эхний рендэрт биш).

## 4. `avatars/{childId}` коллекцийн санал

Прототипт Firestore-д юу ч бичихгүй. Хожим:

```
avatars/{childId}
  childId      string   == doc id
  character    "temuulen" | ...      (дүрийн id)
  tier         "7-10" | "11-14" | "15-18"   (birthDate-аас сервер тооцно)
  outfit       { jersey: string, shorts: string, shoes: string }   (сонголтын id-ууд)
  energy       number 0–100   (сүүлийн 30 хоногийн бэлтгэлээс сервер тооцно)
  streakDays   number
  lastEventAt  timestamp
  updatedAt    timestamp
```

Хэн бичих: outfit/character — эцэг эх (client); energy/streak/tier — сервер (Cloud Function эсвэл `/api/*`, Admin SDK), AI кэштэй ижил зарчим. Rules нөхцөл: `get: canViewChild(childId)`; `create/update: isChildOwner(childId) && affectedKeys().hasOnly(['character','outfit','updatedAt'])` (тоон талбарууд client-ээс хориотой); `list: false`; `delete: isChildOwner`. Энэ нь `aiInsights`-ийн загвартай нийцнэ, одоогийн rules-д хүрэхгүй.

## 5. Эрсдэл

1. **Asset нь rig биш.** 6 PNG нь AI-гаар үүсгэсэн, pose хооронд пропорц бага зэрэг зөрнө (bbox өндөр 649–871 px); crossfade-д "үсрэлт" мэдрэгдэж болно. Жинхэнэ rig хүртэл дизайнерын ажил шаардана.
2. **Bundle/перформанс.** Rive runtime WASM нэмэх нь эхний ачаалалд нөлөөлнө; прототип SVG/CSS-ээр үүнээс зайлсхийнэ. Flag-гүй production bundle яг ижил байх ёстой (build diff-ээр баталгаажуулна).
3. **Reduced motion ба батарей.** Байнгын keyframes (амьсгал, нүд цавчих) PWA-д батарей зарцуулна; `prefers-reduced-motion` ба `visibilitychange`-д зогсоох хэрэгтэй.
4. **Хүүхэд солих / олон хүүхэд.** State memory-д байдаг тул хүүхэд солиход reset (key) заавал; үгүй бол AI картын адил холилдоно.
5. **Event семантик.** `inactive:3d` зөвхөн client тооцоолол (цагийн бүс, offline). `streak:milestone`, `tier:grow`-ийн тодорхойлолт одоогоор байхгүй тул dev хуудаснаас гараар л өдөөнө; бодит дүрэм тогтоогоогүй байж production-д гаргах эрсдэлтэй.

Тэмдэглэл: `claude/BRAND.md` репод байхгүй (2026-10-08); даалгаварт заасан өнгийг шууд ашиглав: ногоон `#2F7D5B`, graphite `#18251D`, цагаан.
