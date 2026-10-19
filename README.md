# Rasta — B2B savdo platformasi

Bitta pnpm monorepo: optomchi web dashboardi, Rasta admin web dashboardi va do‘konchilar uchun Expo / React Native ilovasi. Uchala ilova umumiy HTTP API va SQLite bazasidan foydalanadi.

## Tuzilma

- `apps/wholesaler` — React/Vite optomchi dashboardi.
- `apps/admin` — React/Vite platforma boshqaruvi.
- `apps/mobile` — Android/iOS Expo ilovasi; shu native komponentlarning web eksporti ham mavjud.
- `apps/api` — Node.js API, autentifikatsiya, rol va biznes qoidalari, SQLite.
- `packages/web-ui` — umumiy glassmorphism UI, `@samasante/liquid-glass`, formalar va qidiriladigan tanlovlar.
- `packages/domain` — umumiy formatlash, CSV parser va mahsulot validatsiyasi.
- `scripts/warehouse-sync.mjs` — tashqi ombor CSV eksportini kuzatadigan API adapter.

## Ishga tushirish

Node.js 24 yoki yangiroq va pnpm 11 kerak.

```sh
pnpm install
pnpm build
pnpm start
```

- Optomchi: http://127.0.0.1:4173/
- Admin: http://127.0.0.1:4173/admin/
- Mobil ilova web preview: http://127.0.0.1:4173/mobile/

Birinchi marta toza baza ochishda `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12–128 belgi), ixtiyoriy `ADMIN_NAME` ni muhitda belgilang. Faqat admin yaratiladi; mahsulotlar, do‘konlar va buyurtmalar bo‘sh boshlanadi. Mavjud baza saqlanadi. `dev`, `start` va `preview` demo ma’lumot yaratmaydi.

`pnpm demo` faqat alohida `data/demo.sqlite` sinov bazasida demo ma’lumotlarini yaratadi. Asosiy `data/rasta.sqlite` bazasiga tegmaydi. `NODE_ENV=production` demo yaratishni rad etadi. `pnpm start` mavjud baza bilan demo yaratmasdan ishlaydi. `pnpm test` ajratilgan vaqtinchalik bazada API integratsiya testlarini bajaradi.

Demo email: `optom@rasta.uz`, `baraka@rasta.uz` (ikkinchi optomchi), `dokon@rasta.uz`, `admin@rasta.uz`. Barcha demo parollar: `RastaDemo2026!`. Demo hisoblar mahalliy sinov uchun. Yangi do‘konchi mobil ilovada ro‘yxatdan o‘tadi, yangi optomchini admin yaratadi.

Baza `data/rasta.sqlite` ichida; Git’ga kiritilmaydi. Web sessiyalari HttpOnly cookie, native sessiya esa Expo SecureStore’da saqlanadi. Parollar scrypt bilan hash qilinadi. Sessiyalar 24 soat amal qiladi; parol almashtirish boshqa sessiyalarni yopadi.

### Native mobil ilova

Telefonga o‘rnatiladigan Android release APK uchun [build va imzolash qo‘llanmasi](deploy/ANDROID.md). GitHub Actions’dagi **Build Android APK** workflow production API manzilini APK ichiga yozadi.

```sh
# apps/mobile/.env.example dan apps/mobile/.env yarating.
# EXPO_PUBLIC_API_URL ni kompyuterning telefon uchun ochiq LAN manziliga qo‘ying.
HOST=0.0.0.0 pnpm demo
pnpm mobile
# Alohida terminalda:
pnpm --filter @rasta/mobile android
# yoki Mac + Xcode bilan:
pnpm --filter @rasta/mobile ios
```

Expo Go uchun SDK 58 mos versiyasi kerak. Ishlayotgan telefon `127.0.0.1` orqali kompyuterga ulana olmaydi: LAN IP kerak. Ishlab chiqarishda HTTPS API ishlating. `pnpm --filter @rasta/mobile build:native` iOS va Android JS/assets exportini tekshiradi; bu APK/IPA yoki App Store nashri emas. EAS/Xcode/Android SDK orqali imzolash va qurilmada sinov alohida bajariladi.

### Development

`pnpm demo` API va yig‘ilgan ilovalarni beradi. UI ishlab chiqish uchun `pnpm --filter @rasta/wholesaler dev` yoki `pnpm --filter @rasta/admin dev`. Dev proksi API so‘rovlarini 4173 portga uzatadi. Ruxsatli originlar `ALLOWED_ORIGINS` orqali beriladi.

Toza checkout uchun `pnpm install --frozen-lockfile` ishlating. API testlari ajratilgan vaqtinchalik bazada bajariladi; production bazasiga tegmaydi.

## MVP jarayoni

1. Optomchi SKU, narx, minimal buyurtma va qoldiq bilan mahsulot kiritadi yoki CSV import qiladi.
2. Do‘konchi barcha optomchilar katalogidan yoki bitta optomchidan mahsulot tanlaydi. Savatdagi mahsulotlar serverda narx va qoldiq bo‘yicha qayta tekshiriladi.
3. Aralash savat har bir optomchi uchun alohida buyurtmaga ajratiladi. Qoldiq va buyurtmalar bitta SQLite tranzaksiyasida saqlanadi.
4. Optomchi buyurtmani tayyorlaydi. Optomchi yetkazishida keyingi holatlarni optomchi boshqaradi; Rasta yetkazishida admin kuryer tayinlab, jo‘natadi va yakunlaydi.
5. Yetkazilgan buyurtma holatini qayta o‘zgartirish mumkin emas. Alohida to‘liq qaytarish amali sababni yozadi; mahsulot haqiqatan qaytgan bo‘lsa omborga qaytarish belgilanadi. Qaytarish takroran bajarilmaydi.
6. Moliya hisoboti qaytarilgan buyurtmalarni chiqaradi, komissiya admin Moliya bo‘limida belgilagan foiz bo‘yicha serverda hisoblanadi. Tarif kiritilmaguncha «Belgilanmagan» ko‘rsatiladi. To‘lov va bank orqali refund ulanmagan.

### Ombor va katalog farqi

**Mahsulotlar** — do‘konchiga ko‘rinadigan nom, kategoriya, qadoq, ulgurji narx, minimal buyurtma va e’lon holati. **Ombor** — qoldiq, sababli kirim/chiqim, buyurtma va qaytarish harakatlari tarixi. Import mavjud qoldiqni yangilaydi.

Avvalgi prototipning brauzerdagi `rasta-*-v1` ma’lumotlari o‘chirilmagan. Yangi platforma alohida server bazasi bilan boshlanadi. Eski buyurtmalarda mahsulot ID, telefon va manzil bo‘lmagani uchun ularni taxmin bilan ko‘chirmadik; eski mahsulotlarni CSV orqali import qilish mumkin.

## Import va sinxronlash

[Import qo‘llanmasi](docs/INTEGRATION.md), [CSV namuna](docs/products-template.csv).

## Ishlab chiqarishga joylash

[Deploy qo‘llanmasi](deploy/README.md) va [production server boshqaruvi](deploy/PRODUCTION.md). Docker Compose API va ikkala dashboardni Caddy HTTPS orqali ishlatadi; SQLite alohida doimiy volume ichida. Yangi production baza faqat sozlangan admin bilan boshlanadi. Hozirgi MVPda OTP, parolni email orqali tiklash, push bildirishnomalari, to‘lov provayderi va real logistika API integratsiyasi yo‘q.

## API orqali saqlanadigan holat

- Uchala ilova `/api/state` orqali rolga mos katalog, hamkorlar, buyurtmalar, statistika, kategoriya va sessiya ma’lumotlarini oladi. Biznes ma’lumotlari uchun frontend mock yoki localStorage fallback yo‘q.
- `PATCH /api/cart` — do‘konchining savatini akkaunt bo‘yicha saqlaydi; validatsiyadan o‘tmagan o‘zgarish yozilmaydi. Buyurtma yaratilganda savat tranzaksiya ichida bo‘shaydi.
- `POST /api/notifications/read` — faqat foydalanuvchiga ko‘rinadigan bildirishnomalarni o‘qilgan deb belgilaydi. Panel ochilgach indikator o‘chadi, yangi voqeada qaytadi; reload va boshqa sessiyada holat saqlanadi.
- `PATCH /api/settings` — faqat admin komissiya foizini belgilaydi yoki `null` bilan olib tashlaydi.
- Mobil navigatsiya Flaticon Uicons shriftidan foydalanadi; ikonlar lokal bundle ichida. [Attribution](apps/mobile/assets/ATTRIBUTION.md).

2026-10-19 kuni asosiy mahalliy baza demo/sinov yozuvlaridan tozalandi. Faqat `admin@rasta.uz` saqlandi; eski sessiyalar va integratsiya kalitlari bekor qilindi. Adminning avvalgi demo paroli almashtirilmaguncha biznes amallari API darajasida yopilgan. Boshqa muhitda toza baza yaratish uchun yangi `DATABASE_PATH` va yuqoridagi admin sozlamalaridan foydalaning.

## Tozalangan bazani ishga tayyorlash

1. `pnpm start` bilan asosiy bazani oching va `/admin/` ga kiring.
2. Saqlangan adminning parolini ochilgan «Shaxsiy parol yarating» ekranida yangilang. Yangi parol kamida 12 belgi bo‘lsin; avvalgi va demo parol qabul qilinmaydi. Parol yangilangach boshqaruv paneli ochiladi.
3. Optomchilar bo‘limida haqiqiy hamkorni qo‘shing. Do‘konchilar mobil ilovada o‘zlari ro‘yxatdan o‘tadi. Komissiyani Moliya bo‘limida belgilang.
4. Internetga joylash uchun doimiy disk, HTTPS, `COOKIE_SECURE=true`, `ALLOWED_ORIGINS` va haqiqiy `EXPO_PUBLIC_API_URL` ni sozlang.

Tozalash zaxirasi `data/backups/` ichida (Git’dan chiqarilgan, katalog `0700`, fayl `0600`). Zaxira eski ma’lumotlar va credential hashlarini saqlaydi; ommaga tarqatmang. Asosiy bazaning bo‘sh sahifalari `secure_delete`, `VACUUM` va WAL checkpoint orqali tozalangan.

`node scripts/clean-demo-data.mjs <database> <admin-id> --apply` — faqat API to‘xtatilganda ishlatiladigan texnik tozalash vositasi. Har safar zaxira oladi, tanlangan adminni saqlaydi va barcha biznes ma’lumotlarini o‘chiradi; kundalik ishga tushirishga kiritilmagan.
