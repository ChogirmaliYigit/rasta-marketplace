export const STATUS = [
  "Yangi",
  "Tayyorlanmoqda",
  "Yetkazilmoqda",
  "Yetkazildi",
];
export const CATEGORIES = [
  "Ichimliklar",
  "Yeguliklar",
  "Oziq-ovqat",
  "Sut mahsulotlari",
  "Boshqa",
];
export const money = (n) => `${new Intl.NumberFormat("en-US").format(n)} so‘m`;
export const totalOf = (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r" || quoted) cell += c;
  }
  if (quoted) throw new Error("CSV fayldagi qo‘shtirnoq yopilmagan.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  if (
    !headers ||
    !["sku", "name", "price", "stock"].every((x) => headers.includes(x))
  )
    throw new Error(
      "CSV ustunlari: sku,name,price,stock,minOrder,category,size",
    );
  return rows.map((values, i) => {
    if (values.length !== headers.length)
      throw new Error(`${i + 2}-qator ustunlari noto‘g‘ri.`);
    return Object.fromEntries(headers.map((key, j) => [key, values[j]]));
  });
}
export function validateProduct(input) {
  const p = {
    sku: String(input.sku || "").trim(),
    name: String(input.name || "").trim(),
    price: Number(input.price),
    stock: Number(input.stock),
    minOrder: Number(
      input.minOrder === "" || input.minOrder == null ? 1 : input.minOrder,
    ),
    category: input.category || "Boshqa",
    size: String(input.size || "Dona hisobida").trim(),
  };
  if (!p.sku || !p.name || p.name.length > 100 || p.sku.length > 60)
    throw new Error("Mahsulot nomi va SKU majburiy (100 va 60 belgigacha).");
  if (!Number.isSafeInteger(p.price) || p.price < 1 || p.price > 1e9)
    throw new Error("Narx 1–1 000 000 000 oralig‘idagi butun son bo‘lsin.");
  if (!Number.isSafeInteger(p.stock) || p.stock < 0 || p.stock > 1e7)
    throw new Error("Qoldiq 0–10 000 000 oralig‘idagi butun son bo‘lsin.");
  if (!Number.isSafeInteger(p.minOrder) || p.minOrder < 1 || p.minOrder > 1e7)
    throw new Error("Minimal buyurtma musbat butun son bo‘lsin.");
  if (!CATEGORIES.includes(p.category))
    throw new Error("Kategoriya topilmadi.");
  return p;
}
