# Rasta: uchta subdomen bilan deploy

Bu konfiguratsiya bitta Linux serverda optomchi, admin va API subdomenlarini ishlatadi. Lokal asosiy baza Docker image ichiga kiritilmaydi; yangi volume bo‘sh baza va siz belgilagan admin bilan boshlanadi. Ishlayotgan server tafsilotlari: [PRODUCTION.md](PRODUCTION.md).

Build va testlar serverda bajariladi. 2026-10-19 kuni 18 ta API testi, ikkala dashboard production buildi va Android/iOS JS bundle eksporti serverda muvaffaqiyatli yakunlandi. Native eksport imzolangan APK/IPA emas.

## Keyin to‘ldiriladigan qiymatlar

Repo ildizidan:

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
# deploy/.env ni tahrirlang: uchta domen, admin email/paroli, TLS uchun email.
pnpm deploy:check
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
```

`SUPPLIER_DOMAIN`, `ADMIN_DOMAIN`, `API_DOMAIN` — mavjud domeningiz ostidagi uchta alohida hostname. `https://`, port va yo‘l yozmang. `ADMIN_PASSWORD` 12–128 belgili shaxsiy parol bo‘lsin. `$` va `#` qatnashsa qiymatni bir tirnoqqa oling. `.env` Git va Docker build kontekstidan chiqarilgan. Parolni terminal tarixiga yozmang. `ADMIN_*` faqat bo‘sh bazani yaratishda ishlatiladi; mavjud admin parolini muhit o‘zgaruvchisi almashtirmaydi.

## DNS va server

1. Uchala subdomen uchun serverning IPv4 manziliga `A` yozuv qo‘shing. `AAAA` faqat ishlaydigan IPv6 bo‘lsa qo‘shiladi.
2. Serverda Docker Engine va Docker Compose bo‘lsin. Boshqa xizmatlar 80/443 portlarni band qilmagan bo‘lishi kerak.
3. TCP 80 va 443 ochiq bo‘lsin. UDP 443 HTTP/3 uchun ixtiyoriy. API 4173 porti tashqariga ochilmaydi.
4. DNS serverga yo‘naltirilgach Caddy HTTPS sertifikatini avtomatik oladi va yangilaydi. Avval DNS proxy rejimini o‘chirib, bevosita DNS bilan tekshirish osonroq.

## Ishga tushirish va tekshirish

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100 api gateway
```

- Optomchi va admin o‘z subdomenining `/` yo‘lida ochiladi.
- Har ikki web ilovadagi `/api/*` so‘rovlari Caddy orqali APIga boradi. Cookie shu web hostida qoladi; `Domain` atributi qo‘yilmaydi.
- Mobil ilova `https://API_DOMAIN/api/*` bilan ishlaydi. Originlar aniq ro‘yxat orqali tekshiriladi. Native ilova bearer sessiyasidan foydalanadi.
- `https://API_DOMAIN/api/health` javobi `{"ok":true}` bo‘lishi kerak. Optomchi/admin hostlaridagi `/api/health` ham ishlashi kerak.
- Admin bilan kiring, haqiqiy optomchi yarating; do‘konchi mobil ilovada ro‘yxatdan o‘tadi. Demo ma’lumotlar yuklanmaydi.
- API `TRUST_PROXY=true` bilan ishlaydi, chunki faqat ichki Docker tarmog‘idagi Caddy unga yetib boradi. Caddy forwarding headerini mijoz IP manzili bilan qayta yozadi. API portini internetga ochmang.

## Mobil build

```sh
pnpm build:mobile:production
```

Bu buyruq `deploy/.env` ni tekshirib, `EXPO_PUBLIC_API_URL=https://API_DOMAIN` bilan Android/iOS JS va asset bundlelarini yaratadi. Bu imzolangan APK/IPA emas. EAS yoki native build muhitida ham shu `EXPO_PUBLIC_API_URL` ni belgilang; domen o‘zgarsa mobil ilovani qayta build qilish kerak. Mobil web preview production gatewayga qo‘shilmagan; lokal `/mobile/` ishlashda davom etadi.

## Baza va zaxira

SQLite `/data/rasta.sqlite` faylida, `database` nomli doimiy Compose volume ichida saqlanadi. Bitta API instance ishlatiladi. Server restart va oddiy container yangilanishi bazani o‘chirmaydi. `docker compose down -v` bajarmang: u volume’larni o‘chiradi.

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml exec api node scripts/backup-db.mjs
docker compose --env-file deploy/.env -f deploy/compose.yaml cp api:/data/backups ./backups
```

Zaxira serverdan tashqaridagi xavfsiz joyda ham saqlansin. Tiklashdan oldin API to‘xtatiladi; yaxlit backup SQLite fayli `/data/rasta.sqlite` o‘rniga qo‘yilib, fayl egasi containerdagi `node` (UID 1000) qilinadi. Eski `-wal`/`-shm` fayllarini boshqa baza bilan aralashtirmang. Avval tiklashni alohida volume’da sinang.

## Yangilash

Avval zaxira oling, keyin `up -d --build` bajaring. Domen o‘zgarsa gateway image ham qayta build qilinadi: dashboardlararo havolalar build vaqtida yoziladi. Oldingi image/revision va bazaning mos zaxirasini rollback uchun saqlang.

Manbalar: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Docker Compose healthcheck](https://docs.docker.com/compose/how-tos/startup-order/).
