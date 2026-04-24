# ChampStep — Шинэчлэгдсэн файлуудын жагсаалт

Доорх дарааллаар *бүгдийг нь* паст хийн ашиглаарай. Бүх файл хоорондоо уялдаатай бичигдсэн бөгөөд `npm run dev` дээр алдаа гаргахгүй.

---

## 1. Шинэ сайн мэдээ — аль 4 асуудлыг шийдлээ?

| Асуудал | Шийдэл |
|---|---|
| Нэвтрэх байхгүй байсан | **Firebase Auth** (имэйл/нууц үг + Google) + `LoginPage` |
| Төлбөрийн бүртгэл | **`SubscriptionModal`** — QPay QR үзүүлж, `activatePremium` дуудна |
| PDF үүсгэгдэхгүй байсан | **`lib/pdfExport.ts`** — `jsPDF` ашиглан зураг бүхий бодит PDF татна |
| Нэр хадгалахгүй байсан | **`lib/localStore.ts`** — offline горимд localStorage-д хадгалж, reload-д үлдээнэ |

---

## 2. Паст хийх файлууд

### ✅ ШИНЭ файлууд (create-new)

Дараах замуудад файл байхгүй тул шинээр үүсгэнэ:

- `src/lib/localStore.ts`
- `src/lib/auth.tsx`
- `src/lib/pdfExport.ts`
- `src/components/LoginPage.tsx`
- `src/components/SubscriptionModal.tsx`

### 🔄 БҮРЭН СОЛИГДОХ файлууд (overwrite)

- `src/App.tsx`
- `src/main.tsx`
- `src/lib/firebase.ts`
- `src/hooks/useAchievements.ts`
- `src/i18n/locales/mn.json`
- `src/i18n/locales/en.json`

### ✋ ӨӨРЧЛӨГДӨӨГҮЙ файлууд

- `src/components/AddAchievementForm.tsx`
- `src/components/ChildProfileEditor.tsx`
- `src/components/TimelineDashboard.tsx`
- `src/components/Toast.tsx`
- `src/components/EmptyState.tsx`
- `src/components/LanguageToggle.tsx`
- `src/types/index.ts`
- `src/utils/image.ts` & `src/utils/format.ts`
- `src/i18n/index.ts`
- `src/index.css`
- `package.json`, `tailwind.config.js`, `postcss.config.js`, `vite.config.ts`, `tsconfig.json`, `index.html`

---

## 3. Firebase Console дээр хийх нэмэлт тохиргоо

1. **Authentication → Sign-in method:** Email/Password болон Google-ийг идэвхжүүл.
2. **Firestore:** `/users/{uid}` цуглуулгад зориулж доорх rules нэмээрэй (зөвхөн эзэмшигч нь уншиж/бичих):

```
match /users/{uid} {
  allow read, update: if request.auth != null && request.auth.uid == uid;
  allow create: if request.auth != null && request.auth.uid == uid;
}
```

(Одоогийн `firestore.rules`-д `children` болон `achievements` байгаа — дээрх блокыг нь нэмэх хэрэгтэй.)

3. **.env файлд:** шинээр онцгой тохиргоо нэмэхгүй. Өмнөх 6 утга хангалттай:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## 4. Туршилтын горим (`.env` тохируулаагүй ч ажиллана)

- Нэвтрэх дэлгэцэнд **"Нэвтрэхгүйгээр үргэлжлүүлэх"** товч гарна.
- Нэр / био / зураг өөрчилсөн нь **localStorage-д хадгалагдаж, reload-оор алга болохгүй**.
- Амжилт нэмсэн нь бас **localStorage-д хадгалагдана**.
- PDF товчлуурыг дарахад эхлээд paywall харагдана — "Төлбөрийг баталгаажуулах" дарвал offline Premium идэвхжиж, PDF татагдана (Firestore үгүй тул төхөөрөмж бүр бие даан туршилт хийнэ).

---

## 5. Production дээрх жинхэнэ QPay холболт

Одоогийн `SubscriptionModal` нь UI skeleton. Бодит QPay-д холбох бол:

1. Cloud Function үүсгээд QPay REST API-руу `invoice` үүсгэнэ.
2. Хариуд ирэх `qr_image` base64-ийг клиент рүү буцаана — клиент нь одоогийн декоратив SVG-ийн оронд `<img>` үзүүлнэ.
3. QPay webhook `/callback` ирэхэд өөр Cloud Function нь `/users/{uid}` дээр `subscriptionStatus: premium`, `subscriptionExpiresAt` талбаруудыг шинэчилнэ. `activatePremium` функцын гар аргыг орлоно.
4. `refreshSubscription()`-ийг цонх рэ фокус хийгдэхэд (`visibilitychange`) дуудвал хэрэглэгчид хурдан шинэчлэгдэнэ.

---

## 6. Товч тест (нэвтрэхэд яг юу үзэхэв)

1. `.env` *байхгүй* тохиолдолд: Signup disabled, "Нэвтрэхгүйгээр үргэлжлүүлэх" идэвхтэй.
2. `.env` *байвал*: имэйл/нууц үгээр signup → automatically signed in.
3. Профайл дээр нэрээ өөрчлөөд reload → нэр үлдсэн байх ёстой.
4. PDF Татах → Paywall → "Төлбөрийг баталгаажуулах" → .pdf файл татагдана.
5. Sign out → LoginPage буцаж гарна.

---

Аль файлыг эхэлж ашиглахаа мэдэхгүй бол `src/App.tsx`-ээс эхэл.
