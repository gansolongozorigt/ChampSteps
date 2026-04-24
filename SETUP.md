# ChampStep — Алхам алхмаар суулгах заавар

Энэ заавар нь танд `champstep` хавтас дотрох файлуудыг компьютер дээрээ ажиллуулах бүх алхмыг зааварлана. Програм хөгжүүлэгч биш ч ойлгохоор бичсэн.

---

## 0. Юу бэлэн байх ёстой вэ?

- **Компьютер** (macOS, Windows, эсвэл Linux)
- **Интернэт холболт** (сангууд татахад)
- **Текст засварлагч** — [VS Code](https://code.visualstudio.com/) зөвлөмж
- **Терминал** (macOS-д Terminal, Windows-д PowerShell эсвэл Git Bash)

---

## 1. Node.js суулгах

ChampStep нь Node.js дээр ажилладаг. Хэрвээ танд байхгүй бол:

1. [https://nodejs.org](https://nodejs.org) руу ороод **LTS** (жишээ нь `20.x`) хувилбарыг татаж суулгана.
2. Суулгаж дууссаны дараа терминал нээгээд шалгаарай:

   ```bash
   node -v
   npm -v
   ```

   Хоёулаа хувилбарын дугаар (жишээ нь `v20.11.0`, `10.2.4`) буцаах ёстой. Алдаа гарвал Node.js дахин суулгаарай.

---

## 2. Төслийн файлуудыг өөрийн компьютер дээр байрлуулах

Миний өгсөн `champstep/` хавтас бүхэл төслийг агуулж байгаа. Доорх бүтэцтэй:

```
champstep/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── README.md
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── components/
    │   ├── AddAchievementForm.tsx
    │   └── TimelineDashboard.tsx
    ├── lib/
    │   └── firebase.ts
    ├── types/
    │   └── index.ts
    └── utils/
        ├── format.ts
        └── image.ts
```

Энэ бүх хавтсыг өөрийн ажлын директорт (жишээ нь `~/Projects/champstep` эсвэл `C:\Projects\champstep`) хуулна.

---

## 3. Терминал нээгээд төслийн хавтас руу орох

```bash
cd ~/Projects/champstep
# Windows PowerShell бол:
# cd C:\Projects\champstep
```

`ls` (эсвэл Windows дээр `dir`) хийхэд дээрх файлууд харагдаж байх ёстой.

---

## 4. Сангуудыг (dependencies) суулгах

```bash
npm install
```

Энэ нь `package.json`-д бичсэн бүх сан (React, Vite, Tailwind, Firebase, jsPDF г.м.)-г татаж `node_modules/` хавтас үүсгэнэ. **1–3 минут** үргэлжилж магадгүй.

Алдаа гарвал:
- Интернэт холболтоо шалгана.
- `npm cache clean --force` гэж бичээд дахин `npm install` хийнэ.

---

## 5. Хөгжүүлэлтийн сервер ажиллуулах

```bash
npm run dev
```

Терминалд дараах мессеж гарна:

```
  VITE v5.x.x  ready in 400 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**`http://localhost:5173`** линкийг хөтөч дээрээ нээхэд демо өгөгдөлтэй (Tuya-гийн амжилтууд) Dashboard харагдана. Баруун доор "+" товчийг дарахад **Add Achievement Form** multi-step форм нээгдэнэ.

Сервер ажиллаж байх үед **файлаа хадгалахад автоматаар дахин ачаалагдана** (hot reload).

Зогсоохдоо терминал дээр `Ctrl+C` дарна.

---

## 6. Firebase-тэй холбох (бүрэн ажиллах заавар)

> Аппликейшн нь **өөрөө мэднэ** — `.env` файл байхгүй бол санах ойд ажиллана, байвал Firebase руу автоматаар холбогдоно. `src/lib/firebase.ts`-г **гар аргаар засах шаардлагагүй** — тайлбартай бэлтгэсэн, ажиллахад бэлэн.

### 6.1. Firebase төсөл үүсгэх

1. [https://console.firebase.google.com](https://console.firebase.google.com) руу орно.
2. **Add project** дарж, нэрээ "champstep" гэж өгнө.
3. Төсөл үүссэний дараа **Web App** (`</>` дүрс) нэмнэ.

### 6.2. Firestore болон Storage идэвхжүүлэх

Зүүн цэснээс:
- **Firestore Database** → Create database → Start in **test mode** (дараа нь rules-ээ засна)
- **Storage** → Get started → **test mode**

> Auth-ыг одоохондоо идэвхжүүлэх шаардлагагүй. Phase 2-т нэмнэ.

### 6.3. Web App credentials-ээ хуулах

Project Settings → General → Your apps → Web app → Config. Ингэж харагдана:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "champstep.firebaseapp.com",
  projectId: "champstep",
  storageBucket: "champstep.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123...:web:abc..."
};
```

### 6.4. `.env` файл үүсгэх

Төслийн үндсэн хавтаст (`champstep/` дотор) `.env.example`-г хуулаад `.env` нэртэй болгож утгуудаа оруулна:

```bash
cp .env.example .env
```

`.env` файлыг нээгээд бөглөнө:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=champstep.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=champstep
VITE_FIREBASE_STORAGE_BUCKET=champstep.appspot.com
VITE_FIREBASE_SENDER_ID=123...
VITE_FIREBASE_APP_ID=1:123...:web:abc...
```

> ⚠️ `.env`-г Git-д оруулж болохгүй. `.gitignore`-д аль хэдийн орсон.

### 6.5. Dev server-ээ ДАХИН ажиллуулах

Vite нь `.env`-г зөвхөн эхэлхэд унших тул `Ctrl+C` дараад дараа нь:

```bash
npm run dev
```

Хуудасны дээд хэсгийн "⚠️ Firebase тохируулгагүй байна" шар баннер **арилсан байх ёстой**. Арилаагүй бол `.env` файл нь `src/` дотор биш төслийн үндэс дээр байгаа эсэх, утгуудад орхигдсон зай/хашилт байгаа эсэхийг шалгаарай.

### 6.6. Firestore & Storage rules deploy хийх

Төслийн дотор `firestore.rules` болон `storage.rules` файлууд бий. Firebase CLI ашиглан:

```bash
npm install -g firebase-tools
firebase login
firebase init                # Firestore + Storage сонгоно, одоо байгаа файлуудыг дарж бичихгүй
firebase deploy --only firestore:rules,storage
```

> Эдгээр rules нь **demo-д зориулсан** — бүх хэрэгтэй read/write-ийг зөвшөөрнө. Production-д гарахаасаа өмнө файлууд дахь "PRODUCTION rules" хэсгийг идэвхжүүлэх ёстой.

### 6.7. Туршиж үзэх

Хуудас дээр:
1. Баруун доорх "+" товч → форм → амжилт нэмэх → хадгалах.
2. Firebase Console → Firestore Database → `achievements` collection дотор шинэ баримт орсон байх ёстой.
3. Зураг орсон бол Storage → `achievements/child_001/` хавтсанд файл харагдана.
4. Хуудас **автоматаар шинэчлэгдэнэ** (onSnapshot real-time subscription) — F5 шаардлагагүй.

---

## 6a. Firebase алдаа гарвал (troubleshooting)

| Алдааны мессеж | Шийдэл |
|---|---|
| `Missing or insufficient permissions` | `firestore.rules` deploy хийгээгүй. Алхам 6.6-г дахин хийнэ. |
| `storage/unauthorized` | Storage rules deploy хийгээгүй. |
| Шар баннер арилахгүй | `.env` нь **төслийн үндэс** дээр байх ёстой, `src/` дотор биш. `npm run dev`-г дахин ажиллуулах. |
| `auth/invalid-api-key` | `.env`-д apiKey буруу эсвэл хашилттай хуулагдсан. Хашилт **байх ёсгүй**. |
| Зураг харагдахгүй | Firestore дээр `imageURLs` гэсэн field (U томоор) байгаа эсэхийг шалгах. `imageUrls` гэж бичсэн бол хоосон харагдана. |
| `FirebaseError: Firebase: No Firebase App '[DEFAULT]'` | `main.tsx` дотор `import "./i18n"` бий эсэхийг шалгах. Файлын load дараалал буруу бол үүснэ. |

---

## 7. Production build бэлтгэх

Deploy хийхийн өмнө:

```bash
npm run build
```

Энэ нь `dist/` хавтас үүсгээд бүх кодыг minify хийнэ. Шалгахдаа:

```bash
npm run preview
```

---

## 8. Deploy хийх (сонголт)

### Сонголт А — **Vercel** (хамгийн амархан)

1. [vercel.com](https://vercel.com) дээр бүртгүүлнэ.
2. GitHub repo-доо push хийнэ.
3. Vercel дээр "Import Project" дарж repo-гоо сонгоно.
4. Environment variables хэсэгт өөрийн `VITE_FIREBASE_*` утгуудаа нэмнэ.
5. Deploy товч дарна — **https://champstep.vercel.app** мэт URL гарна.

### Сонголт Б — **Firebase Hosting**

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # public folder: dist, SPA: Yes
npm run build
firebase deploy
```

---

## 9. Түгээмэл алдаа ба шийдэл

| Алдаа | Шийдэл |
|---|---|
| `command not found: npm` | Node.js суулгаагүй. Алхам 1-ийг дахин үзнэ. |
| `EACCES: permission denied` | macOS/Linux дээр `sudo npm install` **битгий** хийгээрэй. `nvm` суулгаарай. |
| Хуудас хоосон харагдаж, console дээр `Failed to resolve import` | `npm install` дахин ажиллуулах. |
| Tailwind класс ажилладаггүй | `tailwind.config.js` доторх `content` нь `./src/**/*.{ts,tsx}` гэж зөв заасан эсэхийг шалгах. |
| Firebase `Missing or insufficient permissions` | Firestore rules-д `request.auth != null` нөхцөлийг зассан эсэхийг шалгах. |

---

## 10. v0.2 — Юу шинэчлэгдсэн бэ?

Энэ хувилбарт дараах полиш нэмэгдсэн:

- **Хэлний сонголт (i18next)** — MN анхны хэл. Баруун дээд буланд MN/EN toggle. Сонголт localStorage-д хадгалагдана.
- **Профайл засварлах** — дашбоардаас хүүхдийн нэр дээр дарахад modal нээгдэж, нэр, товч танилцуулга, төрсөн огноо, профайл зургийг засна.
- **Баяжсан Empty State** — анх нэвтрэх үед зурагтай урам зориг өгөх хэсэг, хайлт/шүүлтүүрээс хоосон ирэх үед өөр бүдүүвч харагдана.
- **Хайлт** — гарчиг, байршил, тайлбарын доторх текстээр хайна.
- **Эрэмбэ** — "Шинэ нь түрүүнд" / "Хуучин нь түрүүнд" сонголттой.

### Хэрхэн шинэ текст нэмэх вэ?

1. `src/i18n/locales/mn.json` болон `src/i18n/locales/en.json` хоёрт **ижил key** нэмнэ.
2. Component дотор `const { t } = useTranslation();` үүсгээд `{t("your.key")}` гэж дуудна.
3. Шууд хадгалаад шалгана — hot reload автоматаар орчуулгыг дахин ачаална.

### Дараагийн алхам (Phase 2)

1. **Firebase Auth UI** — Sign up / Sign in хуудас.
2. **Portfolio Builder** — хэрэглэгч амжилтуудыг сонгоод **jsPDF**-ээр PDF гаргах.
3. **Paywall / Pricing** хуудас — Stripe эсвэл RevenueCat-тай хослуулах.
4. **PWA** — `vite-plugin-pwa` суулгаж offline дэмжлэг + гэрийн дэлгэц рүү нэмэх.
5. **Олон хүүхдийн дэмжлэг** — Child switcher + `children` коллекц.

Хэзээ ч эдгээрийн аль нэгийг нь хийхэд нь би тусалж чадна — зүгээр л хэлээрэй.

---

## Товч тушаалууд (cheat sheet)

```bash
# Анх удаа
cd champstep
npm install

# Өдөр бүр
npm run dev           # http://localhost:5173 дээр нээгдэнэ
# зогсоохдоо Ctrl+C

# Шинэ сан суулгах
npm install <нэр>

# Production build
npm run build
npm run preview

# TypeScript алдаа шалгах
npm run lint
```

Амжилт!
