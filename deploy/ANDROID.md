# Android APK

Do‘konchi ilovasi: `uz.rasta.retailer`. Production API: `https://api.rasta.ardentsoft.uz`.

## Tayyor APK — 0.2.0 (1)

[APK yuklab olish](https://github.com/ChogirmaliYigit/rasta-marketplace/releases/download/android-v0.2.0-1/rasta-android.apk) · [Release va SHA-256](https://github.com/ChogirmaliYigit/rasta-marketplace/releases/tag/android-v0.2.0-1)

Android 7.0+ (API 24), ARM64 va ARMv7. Release build, production HTTPS API, Expo Go talab qilinmaydi. [Build #1](https://github.com/ChogirmaliYigit/rasta-marketplace/actions/runs/39249266017) imzo va bundle ichidagi API manzilini tekshirgan. Fizik telefon sinovi hali bajarilmagan.

## Qayta build qilish

1. `apps/mobile/app.json` ichidagi `android.versionCode` ni oshiring. Foydalanuvchiga ko‘rinadigan release uchun `version` ni ham yangilang.
2. Kodni `main` tarmog‘iga push qiling.
3. GitHub Actions → **Build Android APK** → **Run workflow**. CLI: `gh workflow run android-apk.yml --ref main`.
4. Workflow `rasta-android-apk` artifactini beradi: imzolangan `rasta-android.apk`, SHA-256, manifest va commit/API ma’lumotlari.
5. Tekshirilgan artifactni GitHub Release’ga APK va SHA256SUMS bilan birga joylang. Telefonda ZIP artifact emas, `.apk` fayl ochiladi.

Build release rejimida; Metro yoki Expo Go talab qilinmaydi. ARM64 va ARMv7 telefonlar uchun kutubxonalar bitta APK ichida. Minimal Android versiyasi artifactdagi `manifest.txt` → `sdkVersion` bilan aniqlanadi.

## Imzolash

GitHub encrypted secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`. Alias: `rasta`. Kalitning asosiy nusxasi production serverda `/opt/rasta/android-signing/` katalogida, faqat egasi o‘qiy oladi. Kalit yoki parol Git, release assetlari va loglarga yozilmaydi. Runnerdagi vaqtinchalik keystore builddan so‘ng o‘chiriladi.

Sertifikat SHA-256 fingerprinti: `34:93:42:CD:D8:BA:9B:F1:B8:40:3F:7F:DD:F2:0F:5D:0A:2E:53:B2:76:95:2D:E9:87:71:A5:D9:F5:28:57:2A`.

Keyingi yangilanishlar ham aynan shu kalit bilan imzolanishi kerak. Yangi kalit bilan imzolangan APK avvalgisining ustiga o‘rnatilmaydi. Serverdan tashqarida ham kalitning himoyalangan nusxasini saqlang.

## Telefonda sinash

- APK’ni telefonga yuklab, shu brauzer uchun ilova o‘rnatishga ruxsat bering va o‘rnating.
- Internet yoqilgan holda ilovani oching. Do‘konchi sifatida ro‘yxatdan o‘ting; admin akkaunti web dashboard uchun.
- Katalog faqat admin yaratgan optomchilarning faol mahsulotlarini ko‘rsatadi. Bo‘sh production bazada katalog ham bo‘sh bo‘ladi.
- Haqiqiy buyurtma yaratish production bazaga yozadi va ombor qoldig‘ini kamaytiradi.

APK imzosi, API URL va build tekshiruvi fizik telefonda ishga tushirishni almashtirmaydi. Telefon tekshiruvi natijalari alohida qayd etiladi.

Manbalar: [Expo release build](https://docs.expo.dev/guides/local-app-production/), [Android apksigner](https://developer.android.com/tools/apksigner).
