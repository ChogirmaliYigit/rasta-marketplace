# Ombor importi

## Excel / CSV

Excel’da `CSV UTF-8 (Comma delimited)` formatini tanlang. `.xlsx` to‘g‘ridan-to‘g‘ri parserga berilmaydi. Ustunlar:

| Ustun | Talab |
| --- | --- |
| sku | Majburiy, optomchi doirasida yagona identifikator |
| name | Mahsulot nomi |
| price | Musbat butun so‘m |
| stock | Mavjud, buyurtmaga ajratilmagan qoldiq; manfiy bo‘lmaydi |
| minOrder | Minimal dona, standart 1 |
| category | Ichimliklar / Yeguliklar / Oziq-ovqat / Sut mahsulotlari / Boshqa |
| size | Qadoq tavsifi |

Optomchi → Integratsiya → CSV import → fayl tanlash → tekshiruv → tasdiqlash. Bitta xato qator bo‘lsa hech qaysi mahsulot yozilmaydi. Takrorlangan SKU rad etiladi. Bir xil SKU yangilanadi, yangi SKU yaratiladi; faylda bo‘lmagan mahsulot o‘chirilmaydi. Fayl hajmi 2 MB, 1000 mahsulotgacha.

**Muhim semantika:** `stock` kirim miqdori emas, yangi mavjud qoldiqdir. Tashqi ombor eksporti Rasta buyurtmalariga ajratilgan mahsulotlarni hisobga olishi kerak. Bu MVPda buyurtmalarni tashqi omborga ikki tomonlama yuborish ulanmagan. Eski eksportni qayta yuborish zaxirani noto‘g‘ri tiklashi mumkin; shu sabab adapter faqat fayl mazmuni o‘zgarganda yuboradi.

## Umumiy API

Integratsiya oynasida kalit yarating. Kalit faqat o‘sha optomchiga tegishli. Yangi kalit avvalgisini bekor qiladi. API kalitni frontend kodiga yoki Git’ga qo‘shmang.

`POST /api/integrations/sync`

```
Authorization: Bearer <RASTA_API_KEY>
Content-Type: application/json
```

```json
{"products":[{"sku":"JUICE1","name":"Olma sharbati","price":12000,"stock":120,"minOrder":6,"category":"Ichimliklar","size":"1 litr"}]}
```

Natija: import identifikatori, qatorlar soni va sana. Validatsiya 400, kalit noto‘g‘ri/eskirgan bo‘lsa 401. `supplierId` klientdan qabul qilinmaydi: kalitga qarab server belgilaydi.

## Avtomatik CSV adapter

Ombor dasturi CSV eksportini diskka saqlasin. Quyidagi env qiymatlarini xavfsiz runtime konfiguratsiyasi orqali bering:

```
RASTA_API_URL=http://127.0.0.1:4173
RASTA_API_KEY=<secret>
WAREHOUSE_CSV=/absolute/path/warehouse-export.csv
SYNC_INTERVAL_MS=60000
```

`pnpm sync:warehouse` faylni har 60 soniyada tekshiradi; mazmun o‘zgarganda import qiladi. `SYNC_ONCE=true` bitta importdan so‘ng chiqadi. Tarmoq xatosi logga yoziladi, keyingi siklda qayta urinadi. Aniq ombor dasturi hali tanlanmagani uchun vendor adapteri ulanmagan.
