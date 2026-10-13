# ChampStep — нөөцлөлт ба сэргээлт (Firestore, Storage, Auth)

Сүүлд шинэчилсэн: 2026-10-13. Төсөл: `champstep-22358` (Blaze төлөвлөгөө).

| Зүйл | Утга (2026-10-13-ны судалгаа) |
|---|---|
| Firestore database | `(default)`, **us-central1**, Firestore Native, PITR унтраалттай, delete protection унтраалттай |
| Storage bucket | `gs://champstep-22358.firebasestorage.app`, US-CENTRAL1, Regional, Object Versioning унтраалттай |
| Firestore хэмжээ | 10 коллекц, 64 doc, ~33 KB |
| Storage хэмжээ | 63 файл, 17.4 MB (`achievements/{childId}/*.jpg` 54, `avatars/{childId}/*` 9) |
| Scheduled backup | **Байхгүй** (энэ баримтын A хэсгээр үүсгэнэ) |
| gcloud | `~/Downloads/google-cloud-sdk/bin/gcloud` (567.0.0), account/project тохируулгатай |

Гурван давхарга:

1. **A. Firestore scheduled backups** — Google өөрөө удирдана, bucket хэрэггүй, ~$0.03/GiB/сар. Өдөр бүр (7 хоног) + долоо хоног бүр (14 долоо хоног).
2. **B. Сар бүрийн гар экспорт (offsite)** — Firestore export + Storage зургийн rsync + Auth export. Урт хугацааны хадгалалт.
3. **C. Шалгах жагсаалт** — сар бүр backup list, улиралд нэг удаа сэргээлтийн туршилт.

Тэмдэглэл: Firestore scheduled backup нь зөвхөн Firestore-ийг хамарна. Storage (зураг) болон Auth (хэрэглэгчид) B хэсгээр л нөөцлөгдөнө.

---

## 0. Бэлтгэл: gcloud

gcloud суусан, нэвтэрсэн байна (`gcloud config list` → account, project = champstep-22358). Шинээр суулгах бол: https://cloud.google.com/sdk/docs/install → `gcloud init` → `gcloud auth login`.

```bash
export PATH="$HOME/Downloads/google-cloud-sdk/bin:$PATH"
gcloud config set project champstep-22358
gcloud auth list
```

**Анхаар (Python):** gcloud одоо Python 3.9 дээр ажиллаж "no longer officially supported" гэж анхааруулна. `gcloud firestore ...` командууд ажилладаг, харин `gcloud storage ...` зарим үед `importlib.metadata` алдаа өгдөг тул энэ баримтад bucket-ийн ажилд **`gsutil`** хэрэглэсэн. Бүрмөсөн засах бол:

```bash
brew install python@3.11
export CLOUDSDK_PYTHON="$(brew --prefix)/bin/python3.11"   # ~/.zshrc-д нэмж болно
gcloud components reinstall
```

Шаардлагатай эрх: төслийн Owner (таны account). Firestore backup-д нэмэлт API идэвхжүүлэх шаардлагагүй (Firestore API аль хэдийн идэвхтэй).

---

## A. Firestore scheduled backups (Google-ийн удирддаг)

Region: Firestore database `(default)` **us-central1**-д байгаа тул backup-ууд мөн `us-central1`-д хадгалагдана.

### A1. Хуваарь үүсгэх (нэг удаа)

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

Нэмэлт сонголт: Point-in-time recovery (PITR, 7 хоногийн дотор ямар ч минут руу буцах; хадгалалтын зардал нэмэгдэнэ):
`gcloud firestore databases update --database='(default)' --enable-pitr`. Одоогоор идэвхжүүлээгүй.

Delete protection (database-ийг санамсаргүй устгахаас хамгаална, үнэгүй, зөвлөж байна):
`gcloud firestore databases update --database='(default)' --delete-protection`.

---

## B. Сар бүрийн гар экспорт (offsite, урт хугацаа)

### B1. Backup bucket үүсгэх (нэг удаа)

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
