# ChampStep — нөөцлөлт ба сэргээлт (Firestore, Storage, Auth)

Сүүлд шинэчилсэн: 2026-10-13. Төсөл: `champstep-22358` (Blaze төлөвлөгөө).

| Зүйл | Утга (2026-10-13-ны судалгаа) |
|---|---|
| Firestore database | `(default)`, **us-central1**, Firestore Native, PITR унтраалттай, delete protection унтраалттай |
| Storage bucket | `gs://champstep-22358.firebasestorage.app`, US-CENTRAL1, Regional, Object Versioning унтраалттай |
| Firestore хэмжээ | 10 коллекц, 64 doc, ~33 KB |
| Storage хэмжээ | 63 файл, 17.4 MB (`achievements/{childId}/*.jpg` 54, `avatars/{childId}/*` 9) |
| Scheduled backup | **Байгаа** (2026-10-13-наас): daily 7d `c8c2588f…`, weekly SUN 14w `517f3c4b…` |
| Delete protection / PITR | Хоёулаа **идэвхтэй** (2026-10-13) |
| Backup bucket | `gs://champstep-22358-backups` — Nearline, US-CENTRAL1, versioning ON, lifecycle 400 хоног (2026-10-13-нд үүсгэсэн) |
| gcloud | **`~/google-cloud-sdk`** (588.0.0, bundled Python). Хуучин `~/Downloads/google-cloud-sdk` (567, системийн Python 3.9) ажиллахаа больсон, устгаж болно |

Гурван давхарга:

1. **A. Firestore scheduled backups** — Google өөрөө удирдана, bucket хэрэггүй, ~$0.03/GiB/сар. Өдөр бүр (7 хоног) + долоо хоног бүр (14 долоо хоног).
2. **B. Сар бүрийн гар экспорт (offsite)** — Firestore export + Storage зургийн rsync + Auth export. Урт хугацааны хадгалалт.
3. **C. Шалгах жагсаалт** — сар бүр backup list, улиралд нэг удаа сэргээлтийн туршилт.

Тэмдэглэл: Firestore scheduled backup нь зөвхөн Firestore-ийг хамарна. Storage (зураг) болон Auth (хэрэглэгчид) B хэсгээр л нөөцлөгдөнө.

---

## 0. Бэлтгэл: gcloud

gcloud нь `~/google-cloud-sdk`-д (2026-10-13-нд шинээр суулгасан, bundled Python-той, 588.0.0). `~/.zshrc` нь `~/google-cloud-sdk/path.zsh.inc`-ийг ачаалдаг тул шинэ Terminal-д `gcloud`, `gsutil` шууд ажиллана:

```bash
which gcloud          # /Users/mac/google-cloud-sdk/bin/gcloud байх ёстой
gcloud config list    # account = gansolongozorigt7@gmail.com, project = champstep-22358
gsutil version -l     # алдаагүй
```

Хэрэв `which gcloud` хуучин `~/Downloads/google-cloud-sdk/bin/gcloud`-ийг заавал тэр Terminal-ийн PATH хуучирсан байна: Terminal-ээ шинээр нээх эсвэл `export PATH="$HOME/google-cloud-sdk/bin:$PATH"`. Хуучин `~/Downloads/google-cloud-sdk` хавтас (567.0.0, системийн Python 3.9-өөр ажилладаг, `gsutil` болон `gcloud storage` алдаа өгдөг) хэрэггүй, устгаж болно: `rm -rf ~/Downloads/google-cloud-sdk`.

Шинээр суулгах бол (Homebrew байхгүй Mac дээр): https://cloud.google.com/sdk/docs/install → macOS ARM64 tarball → `~/google-cloud-sdk`-д задлаад `./google-cloud-sdk/install.sh --quiet --path-update true --usage-reporting false --install-python true`. Системийн Python 3.9 дээр install.sh унавал (urllib3 `|` алдаа) эхлээд user-space Python 3.12 суулгана: `curl -LsSf https://astral.sh/uv/install.sh | sh && ~/.local/bin/uv python install 3.12`, дараа нь `CLOUDSDK_PYTHON="$(~/.local/bin/uv python find 3.12)" ./google-cloud-sdk/install.sh ...`. Суулгасны дараа bundled Python (3.14) ашиглагддаг тул `CLOUDSDK_PYTHON` хэрэггүй.

Нэвтрэлт/проект `~/.config/gcloud`-д хадгалагддаг тул SDK солиход дахин нэвтрэх шаардлагагүй болсон. Шаардлагатай эрх: төслийн Owner (таны account).

## A. Firestore scheduled backups (Google-ийн удирддаг)

Region: Firestore database `(default)` **us-central1**-д байгаа тул backup-ууд мөн `us-central1`-д хадгалагдана.

### A1. Хуваарь үүсгэх (нэг удаа — 2026-10-13-нд ХИЙГДСЭН, дахин үүсгэхгүй)

```bash
# Өдөр бүр, 7 хоног хадгална
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d

# Долоо хоног бүр (Ням гараг), 14 долоо хоног хадгална
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=weekly \
  --retention=14w \
  --day-of-week=SUN
```

Эхний backup хуваарь үүсгэснээс хойш 24 цагийн дотор авагдана. Зардал: backup-ийн хэмжээ × $0.03/GiB/сар (одоогийн 33 KB-д бараг тэг).

### A2. Шалгах

```bash
gcloud firestore backups schedules list --database='(default)'
gcloud firestore backups list --location=us-central1
```

`backups list` хоосон бол: хуваарь үүсгээд 24 цаг болоогүй, эсвэл хуваарь байхгүй.

### A3. Сэргээх (АЮУЛТАЙ — үргэлж шинэ database руу)

Backup-ийг `(default)` дээр шууд буулгах боломжгүй, бас хэрэггүй. Үргэлж **тусдаа database** руу сэргээж, шалгаад, зөвхөн дараа нь өгөгдлийг default руу зөөнө.

1. Backup-ийн нэрийг ол:
   ```bash
   gcloud firestore backups list --location=us-central1
   # NAME: projects/champstep-22358/locations/us-central1/backups/<BACKUP_ID>
   ```
2. Шинэ database руу сэргээ (нэр: `restore-YYYYMMDD`; database id нь жижиг үсэг, тоо, зураас):
   ```bash
   gcloud firestore databases restore \
     --source-backup=projects/champstep-22358/locations/us-central1/backups/<BACKUP_ID> \
     --destination-database=restore-20261013
   ```
   Долоон минут орчим. Төлөв: `gcloud firestore operations list`.
3. Шалга (production-д хүрэхгүй, тусдаа database-ийг уншина):
   ```bash
   gcloud firestore databases describe --database=restore-20261013
   ```
   Консол: Firestore → database сонгох (`restore-20261013`) → `users`, `children`, `achievements` коллекцийн тоог production-той тулга. Эсвэл Admin SDK-ээр: `getFirestore(app, "restore-20261013")`.
4. `(default)`-ийг хэзээ солих вэ: **зөвхөн** production өгөгдөл устсан/эвдэрсэн нь батлагдаж, сэргээсэн database зөв гэдэг нь (3) алхамаар тулгагдсан үед. Database-ийг нэр солих боломжгүй тул export/import-оор зөөнө:
   ```bash
   # restore db → bucket
   gcloud firestore export gs://champstep-22358-backups/restore-tmp-20261013 --database=restore-20261013
   # bucket → (default). Import нь ижил id-тай doc-ийг дарж бичнэ, нэмэлт doc-ийг УСТГАХГҮЙ.
   gcloud firestore import gs://champstep-22358-backups/restore-tmp-20261013 --database='(default)'
   ```
   Import-ын өмнө аппыг түр зогсоох (Vercel-д maintenance) эсвэл хэрэглэгч бага үед хийх. Import дууссаны дараа аппыг нээж 1 хэрэглэгчээр нэвтэрч шалгана.
5. Цэвэрлэ (сэргээсэн database төлбөртэй):
   ```bash
   gcloud firestore databases delete --database=restore-20261013
   ```

Point-in-time recovery (PITR, 7 хоногийн дотор ямар ч минут руу буцах; хадгалалтын зардал бага зэрэг нэмэгдэнэ) **2026-10-13-нд идэвхжүүлсэн**:
`gcloud firestore databases update --database='(default)' --enable-pitr`.

Delete protection (database-ийг санамсаргүй устгахаас хамгаална, үнэгүй) **2026-10-13-нд идэвхжүүлсэн**:
`gcloud firestore databases update --database='(default)' --delete-protection`. Шалгах: `gcloud firestore databases describe --database='(default)'`.

---

## B. Сар бүрийн гар экспорт (offsite, урт хугацаа)

### B1. Backup bucket үүсгэх (нэг удаа — 2026-10-13-нд ХИЙГДСЭН)

`gs://champstep-22358-backups`, ижил region (us-central1), Nearline (сард нэг бичих, ховор унших), Object Versioning ON, 400 хоногийн дараа автоматаар устгах lifecycle.

```bash
gsutil mb -p champstep-22358 -c NEARLINE -l us-central1 -b on gs://champstep-22358-backups
gsutil versioning set on gs://champstep-22358-backups

cat > /tmp/champstep-backup-lifecycle.json <<'JSON'
{
  "rule": [
    { "action": { "type": "Delete" }, "condition": { "age": 400 } },
    { "action": { "type": "Delete" }, "condition": { "isLive": false, "numNewerVersions": 3 } }
  ]
}
JSON
gsutil lifecycle set /tmp/champstep-backup-lifecycle.json gs://champstep-22358-backups

# шалгах
gsutil ls -L -b gs://champstep-22358-backups | grep -E "Location|Storage class|Versioning|Lifecycle"
```

`-b on` = uniform bucket-level access. Bucket-ийг public болгохгүй (default-аар private).

### B2. Firestore export

```bash
gcloud firestore export gs://champstep-22358-backups/firestore/$(date +%Y%m%d) --database='(default)'
```

Export нь бүх коллекцийг (promoCodes, system, payments орно) агуулна. Үр дүн: `firestore/YYYYMMDD/` доторх `.overall_export_metadata` + `all_namespaces/`.

### B3. Storage (зураг) rsync

```bash
gsutil -m rsync -r gs://champstep-22358.firebasestorage.app gs://champstep-22358-backups/storage
```

**`-d` ХЭРЭГЛЭХГҮЙ.** `-d` нь эх bucket-д устсан файлыг backup-аас ч устгана; бид устгалыг тусгахгүй (хэрэглэгч санамсаргүй устгасан зураг backup-д үлдэнэ). Object Versioning нь дарж бичигдсэн файлын хуучин хувилбарыг хадгална.

### B4. Auth export

```bash
mkdir -p ~/ChampStep-backups && chmod 700 ~/ChampStep-backups
npx firebase-tools auth:export ~/ChampStep-backups/auth-$(date +%Y%m%d).json --project champstep-22358 --format=json
chmod 600 ~/ChampStep-backups/auth-*.json
```

**Анхаар:** энэ файл хэрэглэгчдийн имэйл, нууц үгийн hash + salt агуулна. Repo-ийн ГАДНА (`~/ChampStep-backups/`), зөвхөн таны машин дээр. Git-д, iCloud-д, чатад хэзээ ч оруулахгүй. Сэргээх: `npx firebase-tools auth:import <file> --hash-algo=SCRYPT ...` (hash-ийн параметрийг консолын Authentication → Users → ⋮ → "Password hash parameters"-аас авна).

### B5. Нэг скрипт: `scripts/admin/monthly-backup.sh`

B2–B4-ийг дарааллаар хийнэ. Идемпотент (тухайн өдрийн Firestore export аль хэдийн байвал алгасна), алдаанд зогсоно (`set -euo pipefail`), нууц утга хэвлэхгүй, bucket/project нэр файлын дээд талд хувьсагчаар.

```bash
bash scripts/admin/monthly-backup.sh            # бодит ажиллуулалт
DRY_RUN=1 bash scripts/admin/monthly-backup.sh  # зөвхөн командуудыг хэвлэнэ
```

Хэвшил: сарын 1-нд `node scripts/admin/payments-report.mjs 31`-тэй хамт (docs/ADMIN.md §7).

---

## C. Шалгах жагсаалт

**Сар бүр (сарын 1):**

- [ ] `gcloud firestore backups list --location=us-central1` → сүүлийн 7 өдрийн + ням гарагийн backup харагдаж байна.
- [ ] `bash scripts/admin/monthly-backup.sh` амжилттай; `gsutil ls gs://champstep-22358-backups/firestore/` дээр өнөөдрийн хавтас.
- [ ] `gsutil du -sh gs://champstep-22358-backups` — хэмжээ урьдчилсан таамагтай ойролцоо (одоогоор < 100 MB).
- [ ] `~/ChampStep-backups/auth-YYYYMMDD.json` үүссэн, хэмжээ > 0.

**Улиралд нэг удаа — сэргээлтийн туршилт (production-д хүрэхгүй):**

1. Хамгийн сүүлийн backup-ийг `restore-YYYYMMDD` database руу сэргээ (A3-ын 1–2).
2. Admin SDK-ээр хоёр database-ийн `users` doc-ийн тоог тулга, нэг хэрэглэгчийн `children` + `achievements` тоог тулга.
3. `gcloud firestore databases delete --database=restore-YYYYMMDD`.
4. Үр дүн, огноог энэ файлын доод хэсэгт "Сэргээлтийн туршилтын бүртгэл"-д бич.

**Жилд нэг удаа:** lifecycle (400 хоног) ба Nearline зардлыг Billing-ээс харах; хэрэглэгч олширвол retention-ийг нэмэх эсэхийг шийдэх.

---

## Сэргээлтийн туршилтын бүртгэл

| Огноо | Backup | Үр дүн | Тэмдэглэл |
|---|---|---|---|
| — | — | — | Хараахан хийгээгүй |
