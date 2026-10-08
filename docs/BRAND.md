# ChampStep — Брэндийн баримт

Шийдвэр: 2026-10-08. Branch `design-refresh`. Цаашид бүх дизайны ажил энэ файлыг иш татна.
Нэг эх сурвалж: `src/styles/tokens.css` (CSS custom properties) + `tailwind.config.js` (ижил утгууд).

## Чиглэл

Цэвэр, орчин үеийн бүтэц: цагаан дэвсгэр, нимгэн хүрээ, тодорхой typography, timeline. Хатуу 3 өнгөний брэнд: **ойн ногоон, graphite хар, цагаан**. Ногоон = өсөлт, алхам. Хүүхдийн апп гэдэг нь мэдрэгдэнэ, гэхдээ хямд биш: эцэг эх, багш итгэнэ; 12–16 насны хүүхэд өөрөө хэрэглэхэд таалагдана.

## Хоёр аяс

| Аяс | Хаана | Дэвсгэр | Текст | Онцлох |
|---|---|---|---|---|
| Тоглоомын | аватар, нүүр ("хүүхдэд үзүүлэх"), бэлтгэл, onboarding hero | `--stage` graphite карт (`--stage-2` давхарга) | `#FFFFFF`, muted `#C9D6CE` | ногоон (`--primary`) цагираг, chip, товч |
| Баримтын | портфолио, PDF, захиалга, нөхцөл | `--bg` цагаан | `--ink` graphite | зөвхөн нэг ногоон зураас/акцент |

PDF Official template-ийн layout-д хүрэхгүй: зөвхөн лого, өнгө солигдоно.

## Өнгө

| Токен | Утга | Хэрэглээ |
|---|---|---|
| `--bg` | `#FFFFFF` | үндсэн дэвсгэр |
| `--bg-soft` | `#F4F7F2` | онцлох хэсэг, segmented control дэвсгэр, AI карт, урилгын карт |
| `--surface` | `#FFFFFF` | карт, модал |
| `--surface-muted` | `#EEF2EC` | input дэвсгэр, muted chip, идэвхгүй сегмент |
| `--ink` | `#18251D` | graphite, үндсэн текст, toast дэвсгэр |
| `--ink-2` | `#3E4F46` | хоёрдогч текст |
| `--ink-3` | `#6E7D74` | caption (цагаан дээр 4.5:1; илүү цайвар хэрэглэхгүй) |
| `--line` | `#DCE5DD` | картын хүрээ, тусгаарлагч |
| `--line-strong` | `#B9C7BC` | хүчтэй хүрээ (focus, select) |
| `--primary` | `#2F7D5B` | ойн ногоон; товч, идэвхтэй nav, timeline цэг; дээр нь текст цагаан |
| `--primary-hover` | `#23634A` | hover/press |
| `--primary-soft` | `#DDF3E6` | chip, soft badge, ★ дэвсгэр |
| `--primary-soft-ink` | `#1F5A42` | soft дэвсгэр дээрх текст |
| `--stage` | `#18251D` | тоглоомын аясны тайз карт |
| `--stage-2` | `#2A3D32` | тайзны давхарга |
| `--stage-ink` | `#FFFFFF` | тайзан дээрх текст |
| `--stage-muted` | `#C9D6CE` | тайзан дээрх muted текст |

**Медаль** (утгатай тул үлдэнэ):

| Медаль | Өнгө | Soft |
|---|---|---|
| gold | `#D4A24C` | `#FFF1C9` |
| silver | `#9CA3AF` | `#EEF0F2` |
| bronze | `#B45309` | `#FDE2C8` |
| participant | `--ink-3` | `--surface-muted` |

**Ангилал** (Спорт / Урлаг / Академик): тусдаа өнгөгүй. Chip бүгд `--primary-soft` / `--primary-soft-ink`; ялгаа нь lucide icon: `dumbbell` / `palette` / `book-open`.

**Status:**

| Төлөв | Өнгө | Soft |
|---|---|---|
| success | `--primary` | `--primary-soft` |
| warn | `#B45309` | `#FDE2C8` |
| error | `#B91C1C` | `#FEE2E2` |
| info | `--ink-2` | `--surface-muted` |

**Tier badge:** free `--surface-muted`/`--ink-2`; family, master, coach бүгд `--primary-soft`/`--primary-soft-ink`, ялгаа нь текст (ГЭР БҮЛ / МАСТЕР / БАГШ).

## Typography

Manrope (Google Fonts, cyrillic subset, self-hosted `public/fonts/*.woff2`, PWA cache). Жин 500/600/700/800.

| Стиль | Хэмжээ / мөр / жин | Класс | Хэрэглээ |
|---|---|---|---|
| Display | 28 / 1.1 / 800 | `.t-display` | хүүхдийн нэр |
| H1 | 22 / 1.2 / 800 | `.t-h1` | дэлгэц, модалын гарчиг |
| H2 | 17 / 1.3 / 800 | `.t-h2` | картын гарчиг, амжилтын нэр |
| Body | 15 / 1.5 / 500 | `.t-body` | үндсэн текст |
| Body-strong | 15 / 1.5 / 700 | `.t-body-strong` | онцолсон текст |
| Caption | 12 / 1.4 / 600 | `.t-caption` | огноо, газар, тайлбар |
| Label | 11 / 1.3 / 700, uppercase, letter-spacing 0.06em | `.t-label` | хэсгийн нэр, сарын label |
| Stat | 22–28 / 800, `tabular-nums` | `.t-stat` | тоо |

## Хэлбэр, зай

| Элемент | Radius |
|---|---|
| card | 16 |
| modal | 24 |
| chip, button | 999 (pill) |
| input | 12 |
| image | 10 |

Spacing: 4pt grid — 4 / 8 / 12 / 16 / 20 / 24 / 32. Shadow бараг байхгүй: карт = `1px solid var(--line)`; зөвхөн FAB, модал `0 8px 24px rgba(28,25,23,0.12)`. Touch target ≥ 44px.

## Icon

Emoji-г UI-аас бүрэн хасна (хэрэглэгчийн бичсэн контентод хүрэхгүй). `lucide-react`, stroke 2, 20/24px. Медаль, ангилалд өнгөт дугуй badge + icon. Лого: `src/components/Logo.tsx` (3 өгсөх дугуй булантай багана: эхний 2 нь `--primary`, өндөр 3 дахь нь `--ink`; wordmark "Champ" ink + "Step" primary) бүх газар (header, login, PDF, manifest icon) энэ нэгийг ашиглана.

## Хөдөлгөөн

Зөвхөн 150–200ms ease-out: карт нэмэгдэх fade+slide, модал slide-up, товч press scale 0.98. `prefers-reduced-motion` хүндэтгэнэ (бүх анимэйшн унтарна).

## Хориотой

- Улбар шар, цэнхэр, ягаан, неон өнгө — хаана ч (медаль, status-аас бусад).
- Хуучин `#EA580C`, `#6366f1`, `#1c1917`, Tailwind `stone-*`, `amber-*`, `indigo-*`, `blue-*`, `rose-*`, `violet-*` класс.
- Emoji UI элемент болгон хэрэглэх.
- Ангилалд тусдаа өнгө.
- Сүүдэр картанд (зөвхөн FAB, модал).
- 4.5:1-ээс муу контрасттай текст (`--ink-3`-ээс цайвар).
- Хар header / хар sidebar (graphite нь зөвхөн тоглоомын аясны тайз, toast).
