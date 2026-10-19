# Rasta production

- Repository: https://github.com/ChogirmaliYigit/rasta-marketplace (`main`).
- Optomchi: https://rasta.ardentsoft.uz
- Admin: https://admin.rasta.ardentsoft.uz
- API: https://api.rasta.ardentsoft.uz/api/health
- Server: `ubuntu@54.79.237.169`, Ubuntu 26.04; Docker Engine + Compose.
- Checkout: `/opt/rasta/app`.
- Maxfiy sozlamalar: `/opt/rasta/production.env` (`0600`, Git tashqarisida).
- GitHub deploy kaliti: serverdagi `~/.ssh/rasta_github_ed25519`, faqat shu repoga read-only.
- Baza: Docker volume `rasta_database`, `/data/rasta.sqlite`.
- Sertifikatlar: `rasta_caddy_data` volume. API tashqariga alohida port bilan ochilmagan.

## Yangilash

```sh
cd /opt/rasta/app
sudo docker compose --env-file /opt/rasta/production.env -f deploy/compose.yaml exec -T api node scripts/backup-db.mjs
git rev-parse HEAD # rollback uchun saqlang
git pull --ff-only origin main
sudo docker run --rm -v /opt/rasta/app:/app:ro -w /app node:24-bookworm-slim node --test tests/*.test.mjs
sudo docker compose --env-file /opt/rasta/production.env -f deploy/compose.yaml build
sudo docker compose --env-file /opt/rasta/production.env -f deploy/compose.yaml up -d --wait
sudo docker compose --env-file /opt/rasta/production.env -f deploy/compose.yaml ps
```

Build yoki test xato bersa, `up` buyrug‘ini bajarmang: ishlab turgan containerlar davom etadi. Yangilanishdan keyin nosozlik bo‘lsa oldingi revisionni checkout qilib, qayta build/up qiling. Baza formatini o‘zgartirgan release uchun uning mos backupini alohida tekshirib tiklang. `down -v` ishlatmang.

## Health va login tekshiruvi

```sh
sudo docker run --rm -v /opt/rasta/app:/app:ro -v /opt/rasta/production.env:/run/production.env:ro -w /app node:24-bookworm-slim node scripts/smoke-production.mjs /run/production.env
```

Bu tekshiruv sessiyani ochib, yopadi; mahsulot, do‘kon yoki buyurtma yaratmaydi. Admin paroli UI orqali o‘zgartirilgach, eski bootstrap paroli bilan login tekshiruvi ishlamaydi. Yangi parolni Git yoki buyruq tarixiga yozmang.

## Mobil ilova

Native build uchun `EXPO_PUBLIC_API_URL=https://api.rasta.ardentsoft.uz`. Android/iOS JS eksporti serverda tekshirilgan. [Imzolangan Android APK](ANDROID.md) GitHub build serverida yig‘ilgan va yuklab olish uchun release’da mavjud. Fizik qurilma sinovi, iOS IPA va do‘konlarga nashr alohida ish. Production server mobil web preview bermaydi.

## Zaxira

`scripts/backup-db.mjs` SQLite yaxlit nusxasini volume ichidagi `/data/backups` katalogiga yozadi. Zaxira faylini serverdan tashqariga ham ko‘chiring. Bir serverdagi volume va backup server yo‘qolishidan himoya qilmaydi. Avtomatik tashqi backup xizmati bu deployda sozlanmagan.
