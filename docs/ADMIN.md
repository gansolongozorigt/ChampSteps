# ChampStep — Админ гарын авлага: үнэгүй / партнерийн эрх олгох

Шинэчилсэн: 2026-10-13. Бүх үйлдэл Firebase Admin SDK-ээр (service account) хийгдэнэ. Скриптүүд
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
| `plan`, `days`, `note` | | ❌ (одоогоор) | `scripts/admin/create-promo.mjs` бичдэг, ирээдүйн серверийн өөрчлөлтөд зориулсан |

**`api/promo/apply.ts` юу шалгадаг** (POST `{ idToken, code }`, transaction):
1. код олдохгүй → `not_found`; `active === false` → `inactive`; `expiresAt` өнгөрсөн → `expired`
2. `usedBy`-д энэ uid байвал → `used`; `maxUses` дүүрсэн → `exhausted`
3. Хэрэглэгчийн одоогийн багцаас **доош** шилжих бол (жишээ: coach идэвхтэй байхад family) → `downgrade`
4. Амжилттай бол: `users/{uid}`-д `subscriptionTier`, `subscriptionActivatedAt`, `subscriptionExpiresAt`,
   `subscription {plan, provider: "promo", promoCode}` бичнэ; ижил багц бол одоогийн дуусах хугацаан дээр нэмнэ.

> ⚠️ **Анхаар:** `api/_lib/promo.ts`-д `PROMO_PLAN = "family"` тогтмол. Өнөөдрийн сервер promo кодоор
> **үргэлж family** багц, `discountMonths × 30` хоногоор олгоно. Код дээр `plan: "coach"` байсан ч
> сервер уншдаггүй. Coach/master-ыг promo-гоор өгөхийн тулд `promo.ts`/`apply.ts`-д `plan`, `days`
> талбарыг дэмжих жижиг өөрчлөлт хэрэгтэй (хараахан хийгээгүй). Тэр хүртэл coach олгоход §3 (grant-tier) ашиглана.

Жишээ doc (Firebase Console → Firestore → `promoCodes` → Add document, id = `PARTNER-2026`):

```json
{
  "code": "PARTNER-2026",
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

- `discountMonths = round(days/30)` гэж бичнэ (сервер үүнийг л уншина), мөн `plan`, `days`-ийг хадгална.
- Байгаа кодыг дарж бичихгүй (exit 1).
- Үүссэн код: **MOTIVATOR-2026** (2026-10-13): maxUses 5, 2027-12-31 хүртэл. Одоогийн серверээр family × 12 сар олгоно (дээрх анхааруулга).

## 3. Шууд багц олгох (партнер, goodwill) — төлбөргүй

```
node scripts/admin/grant-tier.mjs <email> <family|master|coach> <days> [--note "text"] [--role parent|teacher]
# жишээ
node scripts/admin/grant-tier.mjs partner@example.com coach 365 --note "partner: Motivator education, 2026-10-13"
```

- `users/{uid}`-д `subscriptionTier`, `subscriptionActivatedAt`, `subscriptionExpiresAt = now + days`,
  `subscription {plan, provider: "grant", note}`, `grantNote` бичнэ; `expiredFrom/expiredAt` арилгана.
  `payments`-д бичлэг үүсгэхгүй. `--role` өгвөл role-ийг солино.
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
