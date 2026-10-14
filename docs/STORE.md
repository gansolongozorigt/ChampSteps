# ChampStep — Store listing material (App Store / Google Play)

Branch `capacitor`. App ID `mn.champstep.app`. Age rating 4+ (parents' app, not a Kids category app).
Privacy policy URL: https://www.champstep.mn/privacy · Support URL: https://www.champstep.mn/?page=about · Support e-mail: info@champstep.mn

## Name / subtitle

| | mn | en |
|---|---|---|
| Name | ChampStep | ChampStep |
| Subtitle (30) | Хүүхдийн амжилт, бэлтгэлийн дэвтэр | Your child's achievements journal |
| Short description (Play, 80) | Амжилт, өдөр бүрийн бэлтгэл, зорилго — нэг аппд. PDF портфолио. | Achievements, daily practice and goals in one place. PDF portfolio. |

## Description (mn, ≤ 4000)

ChampStep — хүүхдийнхээ замналыг хадгалах эцэг эхийн апп.

Тэмцээн, олимпиад, уралдаан бүрийг нэг газар. Нэр, огноо, газар, медаль, зураг — хэдхэн товшилтоор бүртгээд, он цагийн дарааллаар харна. Спорт, урлаг, академик — бүгд нэг дэвтэрт.

Өдөр бүрийн бэлтгэл. "Өнөөдөр" дэлгэц дээр юу хийснээ нэг мөрөөр бичиж, минутаа сонгоод хадгална. Долоо хоногийн зураас, дараалсан өдрийн тоо хүүхдийг урамшуулна. Интернэтгүй үед ч бичигдэнэ — холбогдмогц хадгалагдана.

Зорилго, тэмцээний өдөр. "2 сарын дараа хотын аварга" гэж зорилго тавь — бэлтгэл бүр түүнд холбогдож, хэд хоног үлдсэн, хэдэн цаг бэлтгэснийг харна. Тэмцээний өдөр хүүхдэд зориулсан дэлгэц: "Чи 61 өдрийн 43-д нь бэлтгэл хийсэн. Чи бэлэн." Үр дүн ямар ч байсан замнал хадгалагдана, амжилт болж бүртгэгдэнэ.

Сануулга. Орой 20:00-д "өнөөдрийн бэлтгэлээ тэмдэглэх үү?", тэмцээний өмнөх өдөр, тэмцээний өглөө — та сонгосон сануулга л ирнэ. Маркетинг байхгүй.

PDF портфолио. Сургууль, клуб, тэтгэлэгт өргөдөлд зориулсан цэвэрхэн PDF — 3 загвар, зурагтай.

Багш, дасгалжуулагч. Урилгын кодоор холбогдсон багш шавийнхаа амжилтыг харж, зөвлөгөө бичнэ. Сэтгэлийн тэмдэглэл зөвхөн эцэг эхэд.

Таны өгөгдөл таных. Хүссэн үедээ JSON/ZIP-ээр татна, аппаас бүрэн устгана.

Монгол, англи, орос хэлээр.

## Description (en, ≤ 4000)

ChampStep is the parents' app for keeping a child's journey.

Every competition, olympiad and contest in one place. Title, date, place, medal, photos — a few taps and it sits on a timeline. Sports, arts, academics — one journal.

Daily practice. On the Today screen write one line about what was practised, pick the minutes, save. The 7-day strip and the streak keep the child going. Works offline — it syncs once you are back online.

Goals and competition day. Set a goal — "city championship in two months" — and every practice session links to it: days left, sessions, hours. On the day, a screen made for the child: "You practised on 43 of 61 days. You are ready." Whatever the result, the journey is kept and recorded as an achievement.

Reminders. 20:00 "log today's practice?", the day before a competition, the morning of it — only the reminders you choose. No marketing.

PDF portfolio. A clean PDF for schools, clubs and scholarship applications — three templates, with photos.

Teachers and coaches. A teacher linked by invite code sees the student's achievements and leaves notes. Reflection notes stay with the parent.

Your data is yours. Export as JSON/ZIP any time, delete everything from the app.

Mongolian, English and Russian.

## Keywords (App Store, 100 chars)

mn: амжилт,хүүхэд,бэлтгэл,тэмцээн,портфолио,эцэг эх,дэвтэр,спорт,урлаг,олимпиад
en: achievements,kids,practice,competition,portfolio,parent,journal,sports,arts,goals

## Category

Primary: Education. Secondary (App Store): Productivity. Suggestion: Education — the listing talks about children's learning journeys and schools/clubs use the PDF; Productivity fits the daily-practice habit angle as secondary.

## Age rating

4+ (no objectionable content). Not a Kids category app: the user is the parent; "Made for Kids" is not selected. Google Play: target audience 18+ (parents), not designed for children.

## Apple privacy nutrition label (App Privacy)

| Data | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Contact Info — Email Address, Name | Yes | Yes | No | App functionality, account |
| User Content — Photos, Other user content (achievements, notes, child name/birth date) | Yes | Yes | No | App functionality |
| Identifiers — User ID (Firebase uid), Device ID (push token) | Yes | Yes | No | App functionality (notifications) |
| Purchases — Purchase history (web plan records shown in app) | No (not in the app build) | — | — | — |
| Diagnostics | No | — | — | — |

No third-party advertising, no tracking (ATT prompt not needed).

## Google Play Data safety

- Collected: Name, Email, Photos (user-provided), App activity (achievements/practice entries), Device or other IDs (FCM token).
- Shared with third parties: No (processors only: Firebase, Vercel; AI insight sends achievement text to Anthropic — declare "App info and performance → other" as processed, not shared).
- Encrypted in transit: Yes. Deletion: in-app account deletion (Settings → Delete account) and request via info@champstep.mn.
- Data not sold. No ads.

## Screenshots (6.7" iPhone 1290×2796, Android phone 1080×2400)

1. Today screen with goal card + streak (`scratch/capacitor/ios-today.png`)
2. Achievements timeline with a photo card
3. Add achievement (step 1)
4. Competition day screen
5. PDF preview / share sheet
6. Settings — reminders (no purchase UI)

## What is NOT in the store build

No purchases, prices, promo codes or links to the website for plans (Apple 3.1.1). The app shows the current plan and expiry only.
Push on iOS waits for the APNs key (Developer account); Android push is live. Sign in with Apple waits for the Developer account (code behind VITE_APPLE_SIGNIN=1).
