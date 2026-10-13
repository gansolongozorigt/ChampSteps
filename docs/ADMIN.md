# ChampStep — Админ гарын авлага: үнэгүй / партнерийн эрх олгох

Шинэчилсэн: 2026-10-13 (plan/days дэмжлэг; QPay production хэсэг нэмэгдсэн). Бүх үйлдэл Firebase Admin SDK-ээр (service account) хийгдэнэ. Скриптүүд
`FIREBASE_SERVICE_ACCOUNT_B64`-ийг env эсвэл репогийн `.env`-ээс уншина; нууц утгыг хэзээ ч хэвлэхгүй.

## 1. Promo кодын механизм (кодоос)

**Коллекц:** `promoCodes/{CODE}` — client хандах эрхгүй (rules: read/write false), зөвхөн сервер.
Doc id = код (том үсэг, `A-Z 0-9 _ -`, 3–32 тэмдэгт).

| Талбар | Төрөл | Сервер хэрэглэдэг эсэх | Тайлбар |
|---|---|---|---|
| `code` | string | ✅ | doc id-тай ижил |
| `discountMonths` | number | ✅ | хэдэн 30 хоногийн "сар" (`months` хуучин нэр ч уншигдана) |
| `maxUses` | number | ✅ | нийт хэдэн хэрэглэгч ашиглаж болох; 0 = хязгааргүй |
| `usedBy` | string[] | ✅ | ашигласан uid-ууд (сервер arrayUnion-оор бичнэ) |
| `usedCount` | number | ✅ | increment |
| `expiresAt` | Timestamp \| ISO string \| null | ✅ | кодыг хэрэглэж болох сүүлийн хугацаа |
| `active` | boolean | ✅ | false бол "inactive" |
| `createdAt`, `createdBy`, `lastUsedAt` | | | мэдээллийн |
| `plan` | `"family" \| "master" \| "coach"` | ✅ | олгох багц; байхгүй/буруу бол **family** (хуучин кодууд) |
| `days` | number | ✅ | хугацаа хоногоор; байхгүй/0 бол `discountMonths × 30` (хуучин кодууд) |
| `note` | string | | мэдээллийн |

**`api/promo/apply.ts` юу шалгадаг** (POST `{ idToken, code }`, transaction):
1. код олдохгүй → `not_found`; `active === false` → `inactive`; `expiresAt` өнгөрсөн → `expired`
2. `usedBy`-д энэ uid байвал → `used`; `maxUses` дүүрсэн → `exhausted`
3. Багц = `plan` (байхгүй бол family), хугацаа = `days` (байхгүй бол `discountMonths × 30`).
   Хэрэглэгчийн одоогийн идэвхтэй багцаас **доош** шилжих бол (жишээ: coach идэвхтэй байхад family код) → `409 downgrade`;
   ижил багц бол одоогийн дуусах хугацаан дээр нэмнэ; дээш бол үлдсэн хоногийг үнийн харьцаагаар кредит болгоно.
4. Амжилттай бол: `users/{uid}`-д `subscriptionTier`, `subscriptionActivatedAt`, `subscriptionExpiresAt`,
   `subscription {plan, provider: "promo", promoCode}` бичнэ. Хариу `{ plan, days, months, expiresAt }`.

> Хуучин кодууд (`plan`/`days`-гүй, зөвхөн `discountMonths`) өмнөх шигээ family × сар олгосоор байна.

Жишээ doc (Firebase Console → Firestore → `promoCodes` → Add document, id = `PARTNER-2026`):

```json
{
  "code": "PARTNER-2026",
  "plan": "coach",
  "days": 365,
  "discountMonths": 12,
  "maxUses": 5,
  "usedBy": [],
  "usedCount": 0,
  "active": true,
  "expiresAt": "2027-12-31T23:59:59.000Z",
  "note": "partner: ..."
}
```

Өөр арга: `/api/promo/admin` (ADMIN_EMAIL аккаунтаар, аппын Admin хуудас → Promo) — `create` үйлдэл
`code, discountMonths, maxUses, expiresAt` авна.

## 2. Promo код үүсгэх скрипт

```
node scripts/admin/create-promo.mjs <CODE> <family|master|coach> <days> <maxUses> [--until YYYY-MM-DD] [--note "text"]
# жишээ
node scripts/admin/create-promo.mjs MOTIVATOR-2026 coach 365 5 --until 2027-12-31 --note "partner: Motivator education"
```

- `plan`, `days`-ийг бичнэ (сервер эдгээрийг уншина); `discountMonths = round(days/30)`-ийг хуучин admin UI-д харагдахын тулд давхар хадгална.
- Байгаа кодыг дарж бичихгүй (exit 1).
- Үүссэн код: **MOTIVATOR-2026** (2026-10-13): coach × 365 хоног, maxUses 5, 2027-12-31 хүртэл.

## 3. Шууд багц олгох (партнер, goodwill) — төлбөргүй

```
node scripts/admin/grant-tier.mjs <email> <family|master|coach> <days> [--note "text"] [--role parent|teacher]
# жишээ
node scripts/admin/grant-tier.mjs partner@example.com coach 365 --note "partner: Motivator education, 2026-10-13"
```

- `users/{uid}`-д `subscriptionTier`, `subscriptionActivatedAt`, `subscriptionExpiresAt = now + days`,
  `subscription {plan, provider: "grant", note}`, `grantNote` бичнэ; `expiredFrom/expiredAt` арилгана.
  `payments`-д бичлэг үүсгэхгүй. `--role` өгвөл role-ийг солино. Promo кодоор өөрөө идэвхжүүлэх боломжгүй
  (жишээ: аль хэдийн илүү өндөр багцтай) хэрэглэгчид энэ скриптийг хэрэглэнэ.
- Өмнөх `users` doc `scratch/grant-backup-<ts>.json`-д хадгалагдана (gitignore); буцаахдаа тэр утгуудыг гараар тавина.
- Хугацаа дуусахад `/api/subscription/status` автоматаар free болгоно (хэвийн урсгал).

## 4. Хэрэглэгч аппаас promo кодыг хэрхэн оруулах

Багцын модал (⭐ товч эсвэл цэс → Багц → "Багцаа ахиулах") → доод хэсэгт **"Хямдралын код"** талбар →
код бичээд **"Хэрэглэх"**. Амжилттай бол "{{N}} сар үнэгүй эрх нэмэгдлээ!" гэж гарч багц шууд идэвхжинэ.
Алдааны мессеж: буруу/дууссан, аль хэдийн ашигласан, тоо дууссан, идэвхгүй.

## 5. Хэрэглэгчийн тойм, устгал

- Бүх аккаунтын тойм (зөвхөн унших): `node scratch/list-accounts-20261013.mjs` (scratch, gitignore).
- Хэрэглэгч өөрөө: апп → Бүртгэлийн тохиргоо → Бүртгэлээ устгах (`/api/account/delete`); хүүхэд: Профайл засах → Аюултай бүс.
- Админ устгал: `api/_lib/deletion.ts`-ийн `deleteAccountData`-г `adminDeletionDeps`-тэй дуудна (жишээ `scratch/delete-accounts-20261013.mjs`, `--dry-run` эхлээд). payments хэзээ ч устгагдахгүй.

## 6. QPay production (2026-10-13-наас)

**Env (Vercel → Settings → Environment Variables → Production; утгыг энд хэзээ ч бичихгүй):**

| Нэр | Юу | Хаанаас |
|---|---|---|
| `QPAY_BASE_URL` | `https://merchant.qpay.mn` (`/v2`-гүй; sandbox: `https://merchant-sandbox.qpay.mn`) | код |
| `QPAY_USERNAME`, `QPAY_PASSWORD` | merchant client credential | QPay-ийн гэрээний мэйл |
| `QPAY_INVOICE_CODE` | `invoice_code` | QPay |
| `QPAY_CALLBACK_SECRET` | 32 тэмдэгт санамсаргүй (`openssl rand -hex 16`); callback URL-ийн `s=` | өөрсдөө |
| `APP_URL` | `https://www.champstep.mn` (эцэст нь `/` байхгүй) | — |

`VITE_QPAY_SANDBOX`-ийг Production-д **тавихгүй** (client-д "simulate" товч гаргадаг build-time flag).
Env солисны дараа заавал redeploy. Sandbox эсэхийг сервер `QPAY_BASE_URL`-д "sandbox" байгаа эсэхээр л шийднэ;
production үед `/api/qpay/simulate-paid` 404 буцаана.

**Callback URL:** invoice бүрт сервер `https://www.champstep.mn/api/qpay/callback?order=<orderId>&s=<secret>`
гэж үүсгэж QPay-д `callback_url`-аар илгээнэ (`www`-тэй; `champstep.mn` 308 redirect хийдэг). QPay-д урьдчилан
бүртгүүлэх шаардлага гарвал яг энэ үндсийг өгнө.

**Урсгал (кодоос):** `create-invoice` → `payments/{orderId}` (status pending, invoiceId) → хэрэглэгч QR төлнө →
QPay `callback` дуудна → сервер `/v2/payment/check`-ээр баталгаажуулж (PAID, дүн бүрэн) байж л
`activateSubscription` → `payments` status paid, `users/{uid}` subscription → client `status`-ийг 3с тутам poll хийж
"Амжилттай" харуулна. Callback-ийн body-д хэзээ ч итгэхгүй (`api/_lib/qpayCallback.ts`, тест `tests/qpay-callback.test.mjs`).
Access token `system/qpayToken` доктод кэшлэгдэнэ (бүх instance хуваалцана, дуусахаас 60с өмнө шинэчилнэ) — гараар хүрэхгүй;
асуудал гарвал докыг устгахад дараагийн хүсэлт шинээр авна.

**Төлбөр баталгаажаагүй үед (хэрэглэгч төлсөн гэж байгаа ч багц идэвхжээгүй):**

1. `node scripts/admin/payments-report.mjs --order <orderId>` — status, invoiceId, paymentId, users doc-ийн tier/expiresAt.
   orderId-г хэрэглэгч мэдэхгүй бол `node scripts/admin/payments-report.mjs 7` (сүүлийн 7 хоног) жагсаалтаас email-ээр ол.
2. `vercel logs --since 2h --no-follow | grep qpay` — `callback` мөр ирсэн эсэх, `[qpay] callback but not paid/insufficient`
   (QPay check PAID биш / дүн дутуу), `[qpay] callback check failed` (QPay API алдаа, 502 → QPay дахин дуудна), `activated:`.
3. Callback огт ирээгүй бол QPay merchant портал → Invoice → төлөв PAID эсэх. PAID боловч бидэнд pending бол callback URL-ийг
   дахин дуудна: `curl "https://www.champstep.mn/api/qpay/callback?order=<orderId>&s=<QPAY_CALLBACK_SECRET>"` →
   сервер өөрөө `/v2/payment/check` хийгээд PAID бол идэвхжүүлнэ (`SUCCESS`), үгүй бол `PENDING`.
4. Бүх зүйл зөв мөртлөө идэвхжихгүй бол түр `grant-tier.mjs`-ээр олгоод (note-д orderId), QPay-тэй тодруулна.

**Буцаалт:** кодоор хийгдэхгүй. QPay merchant портал дээр тухайн invoice/payment-ийн refund-ийг гараар хийнэ; дараа нь
`users/{uid}`-ийн subscription талбаруудыг гараар free болгоно (`payments` док устгахгүй, `refundedAt` тэмдэглэж болно).

**Сар бүрийн тооцоо:** `node scripts/admin/payments-report.mjs 30 --status paid` (эсвэл `--csv > scratch/payments-YYYY-MM.csv`).

**Хийгдээгүй:** и-баримт (eBarimt 3.0), жилийн багц — тусдаа.

## 7. Сар бүрийн нөөцлөлт (2026-10-13-наас)

Сарын 1-нд `node scripts/admin/payments-report.mjs 31`-тэй хамт `bash scripts/admin/monthly-backup.sh` ажиллуулна (Firestore export + Storage rsync + Auth export; дэлгэрэнгүй, сэргээх заавар: docs/BACKUP.md). Firestore-ийн өдөр тутмын/долоо хоногийн scheduled backup Google талд автоматаар явна.
