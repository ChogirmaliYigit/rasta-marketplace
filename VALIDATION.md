# Rasta platforma MVP — tekshiruv natijalari

## Production deploy — 2026-10-19

- Linux serverda 18/18 test o‘tdi; vaqtinchalik test bazalari o‘chirildi.
- `rasta-api` va `rasta-gateway` production Docker imagelari muvaffaqiyatli yig‘ildi.
- Uchala subdomen uchun haqiqiy HTTPS sertifikati olindi, `/api/health` javoblari 200; HTTP HTTPSga 308 orqali yo‘naltiriladi.
- Public API orqali admin login/logout, Secure/HttpOnly/SameSite=Strict host cookie va ruxsatsiz so‘rovlarning 401 javobi tekshirildi.
- Yangi baza: 1 admin; 0 optomchi, do‘kon, mahsulot va buyurtma. Lokal demo baza serverga ko‘chirilmadi.
- Brauzerda production admin login, dashboard, Optomchilar va akkaunt/xavfsizlik oynasi ochildi.
- Android va iOS Hermes/asset eksporti `https://api.rasta.ardentsoft.uz` bilan o‘tdi. Imzolangan APK/IPA va fizik qurilma tekshiruvi bajarilmadi.
- SQLite backup yaratildi. Vaqtinchalik mobil build konteyneri va verification image tagi olib tashlandi.

Quyida avvalgi mahalliy tekshiruvlar tarixi saqlangan; ular hozirgi production bazasi holatini bildirmaydi.

Sana: 2026-10-18. Uchala ilova umumiy Node API / SQLite bilan tekshirildi.

## Build

- `pnpm install --frozen-lockfile`: muvaffaqiyatli, pnpm workspace 7 paket.
- `pnpm build`: muvaffaqiyatli — optomchi Vite, admin Vite, Expo web eksport.
- `pnpm --filter @rasta/mobile build:native`: Android va iOS Hermes bundle eksportlari muvaffaqiyatli.
- `pnpm test`: 12/12 integratsiya testi o‘tdi.
- `pnpm demo`: 127.0.0.1:4173 portida ishga tushirildi.

Lucide kutubxonasining `use client` bundler ogohlantirishlari hamda Expo CLI rang muhiti ogohlantirishlari buildni to‘xtatmaydi. IAB konsolida ilova xatolari va ogohlantirishlari aniqlanmadi.

## API sinovlari

Avtorizatsiya va rol chegaralari; aralash savatni optomchilarga ajratish; qoldiq/minimal miqdor/kasr validatsiyasi; atomik yozish va rollback; do‘kon yaratish; holatlar ketma-ketligi va Rasta yetkazish ruxsati; yetkazilgan buyurtmani bloklash; bir martalik refund va qoldiqni qaytarish; CSV quote/duplicate/validatsiya; API kalit doirasi va rotatsiyasi; to‘xtatilgan optomchi; ro‘yxatdan o‘tish/profil/parol/sessiya; yangi optomchi onboarding; server qayta ishga tushganda saqlanish; bir xil nomli do‘konlarning alohida ID bilan tanlanishi.

## Brauzerda bajarilgan jarayonlar

1. Uchala rolda demo kirish.
2. Bildirishnoma tashqariga bosilganda yopilishi; profil akkaunt/xavfsizlik menyusi.
3. Mobil katalogdan Coca-Cola va Barilla tanlash, ikki optomchili savat (18 dona, 276 600 so‘m).
4. Mobil savatdan #10483 va #10484 buyurtmalar yaratish, optomchi va adminda ko‘rinishi.
5. Optomchi #10483 ni tayyorladi; admin kuryer tayinlab jo‘natdi va yetkazildi deb belgiladi.
6. Yetkazilgan buyurtmada holatni o‘zgartirish amali yo‘q, alohida refund mavjud.
7. Sababli refund va qaytgan 6 dona mahsulotni omborga tiklash; mobil kuzatuvda qaytarish tarixi ko‘rindi.
8. Mavjud do‘kon qidiruvi va kontaktlarni to‘ldirish; yangi nom bilan Sinov Hamkor Market avtomatik yaratildi.
9. Qidiriladigan mahsulot tanlovi, minimal miqdor, buyurtma tarkibi va jami summa.
10. CSV fayl tanlash, ikki qator preview, tasdiqlash, katalog/ombor/import tarixida natija.
11. Yangi mahsulot QA-TEA yaratish, kategoriya tanlovi va SKU bo‘yicha qidirish.
12. Mobil ekran 390×844 va 320×740 o‘lchamlarda gorizontal overflow bermadi; admin 1384×804 desktopda tekshirildi.
13. Yangi do‘kon tanlash kontaktlarni tozalaydi. Combobox Escape bosilganda yopiladi, dialog ochiq qoladi.

Brauzer tekshiruvlari mahalliy demo bazasida bajarildi; test mahsulotlari va buyurtmalari shu bazada saqlandi. Avtomatik API testlari alohida vaqtinchalik bazalarda bajarilib, demo bazasiga tegmadi.

## Chegaralar

Native Android/iOS JavaScript va asset eksportlari tekshirildi; jismoniy qurilma, simulator, APK/IPA imzolash va App Store / Play Store nashri bajarilmagan. Telefon uchun EXPO_PUBLIC_API_URL kompyuter LAN IP manziliga sozlanadi. Bank orqali to‘lov/refund, SMS/OTP, push, parolni email orqali tiklash va aniq vendorning ikki tomonlama ombor integratsiyasi ulanmagan. CSV va umumiy API importi ishlaydi. Excel fayli CSV UTF-8 ko‘rinishida saqlanadi.

Mahalliy iCloud generated fayllarni evict qilgani uchun node_modules/.pnpm tekshirilgan /tmp keshiga yo‘naltirilgan; dependency tekshiruvi yoqilgan. Qayta tiklash ko‘rsatmasi README ichida.

## 2026-10-19 — API va brauzer izohlari

- `pnpm test`: 16/16 o‘tdi. Yangi tekshiruvlar: akkauntga bog‘langan savat, reload/server restart saqlanishi, noto‘g‘ri miqdorda rollback, checkout bilan atomik tozalash, bildirishnoma o‘qilishi va yangi voqea, komissiya admin ruxsati, demosiz bo‘sh production baza.
- `pnpm build`: optomchi, admin va Expo web buildlari muvaffaqiyatli.
- `pnpm --filter @rasta/mobile build:native`: Android/iOS Hermes bundlelari va lokal Flaticon TTF eksporti muvaffaqiyatli. Fizik qurilmada ishga tushirish bu tekshiruvga kirmaydi.
- Brauzer: yangi ikonlar ko‘rinadi; reklama cardi yo‘q; butun profil qatori akkaunt modalini ochadi. 663×711 ekranda 711px scroll qilinganda profil bottom=711; admin 663×450 ekranda bottom=450.
- Bildirishnoma paneli o‘qilgan holatni APIga yozadi; indikator yo‘qolishi va reload’dan keyin saqlanishi tekshirildi. Tashqariga bosilganda `aria-expanded=false`.
- Mobil: Coca-Cola 6 dona savatga qo‘shildi; reload’dan so‘ng 6 dona serverdan tiklandi. Sinov yakunida savat avvalgi bo‘sh holatga qaytarildi; buyurtma yaratilmadi.
- Admin Moliya sahifasi sozlanmagan komissiya uchun «Belgilanmagan» ko‘rsatadi.
- Uchala production sahifasida konsol error/warn ro‘yxati bo‘sh. Build paytida Lucide `use client` va Expo rang sozlamasi ogohlantirishlari bor; buildlar exit 0.
- Dashboard va mobil ko‘rinishlar mahalliy brauzerda tekshirildi.
- Mavjud biznes bazasi saqlandi. Yangidan demo yozuvlari qo‘shilmadi; oldingi demo/sinov yozuvlari bazada qolgan.


## 2026-10-19 — asosiy bazani tozalash

- Asosiy baza tozalandi: 1 admin, 0 optomchi, 0 do‘kon, 0 mahsulot, 0 buyurtma, 0 ombor harakati, 0 import, 0 API integratsiyasi; savat va bildirishnoma o‘qish tarixi bo‘sh.
- 6 eski sessiya bekor qilindi. Brauzer tekshiruvi uchun faqat yangi admin sessiyasi ochildi.
- Zaxira: `data/backups/before-clean-2026-10-19T11-06-35-713Z.sqlite` (0600). `PRAGMA integrity_check`: `ok`.
- `pnpm test`: 18/18 o‘tdi. Tozalash, adminni saqlash, zaxira, sessiyalarni bekor qilish, majburiy parol yangilash va production’da demo yaratishni rad etish tekshirildi.
- `pnpm build:web`: ikkala dashboard muvaffaqiyatli yig‘ildi. Mobil kodi o‘zgarmadi.
- Brauzerda optomchi/mobil eski sessiyalari kirish ekraniga qaytdi. Admin bilan kirilganda shaxsiy parol yaratish ekrani ochildi. Yangi admin paroli foydalanuvchi tomonidan kiritilishi kerak; test paroli asosiy bazaga yozilmadi.
- API 4173-portda asosiy tozalangan baza bilan ishlamoqda. `pnpm demo` endi alohida `data/demo.sqlite` ishlatadi.
