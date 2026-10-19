import { randomUUID } from "node:crypto";
import {
  STATUS,
  CATEGORIES,
  totalOf,
  validateProduct,
} from "../../packages/domain/index.js";
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const requireThat = (condition, message, status = 400) => {
  if (!condition) throw new AppError(message, status);
};
const str = (x, max = 200) =>
  String(x ?? "")
    .trim()
    .slice(0, max);
export const publicUser = ({ passwordHash, ...user }) => user;
export function snapshot(s, u) {
  const supplier = u.role === "supplier";
  const orders = s.orders.filter(
    (o) =>
      u.role === "admin" ||
      (supplier ? o.supplierId === u.supplierId : o.storeId === u.storeId),
  );
  return {
    user: publicUser(u),
    categories: s.settings?.categories || CATEGORIES,
    settings: { commissionRate: s.settings?.commissionRate ?? null },
    cart: u.role === "retailer" ? (s.carts?.[u.id] || {}) : undefined,
    notifications: notifications(s, u),
    metrics: metrics(orders, s.settings?.commissionRate),
    suppliers: s.suppliers,
    stores:
      u.role === "retailer"
        ? s.stores.filter((x) => x.id === u.storeId)
        : s.stores,
    products: s.products.filter((p) =>
      supplier
        ? p.supplierId === u.supplierId
        : u.role === "admin" ||
          (p.active &&
            s.suppliers.some((x) => x.id === p.supplierId && x.active)),
    ),
    orders,
    movements: s.movements
      .filter(
        (m) =>
          u.role === "admin" || (supplier && m.supplierId === u.supplierId),
      )
      .slice(0, 100),
    imports: s.imports
      .filter(
        (m) =>
          u.role === "admin" || (supplier && m.supplierId === u.supplierId),
      )
      .slice(0, 30),
    integration: s.integrations
      .filter((i) => supplier && i.supplierId === u.supplierId)
      .map(({ keyHash, ...rest }) => rest),
  };
}
export function notifications(s, u) {
  const receipts = s.notificationReads?.[u.id] || {};
  const orders = s.orders.filter(o => u.role === "admin" ||
    (u.role === "supplier" ? o.supplierId === u.supplierId : o.storeId === u.storeId));
  const items = orders.map(o => ({
    id: `order:${o.id}:${o.history.length}:${o.courier || ""}`,
    title: `#${o.id} · ${o.customer}`,
    message: `${o.status}${o.courier ? " · " + o.courier : ""}`,
    page: "Buyurtmalar", orderId: o.id,
    at: o.history.at(-1)?.at || o.date,
  }));
  if (u.role !== "retailer") for (const p of s.products.filter(p =>
    (u.role === "admin" || p.supplierId === u.supplierId) && p.stock < 20)) {
    const movement = s.movements.find(m => m.productId === p.id);
    items.push({ id: `stock:${p.id}:${movement?.id || p.stock}`,
      title: p.name, message: `Omborda ${p.stock} dona qoldi.`,
      page: u.role === "admin" ? "Umumiy" : "Ombor", at: movement?.at || null });
  }
  return items.sort((a,b) => (b.at || "").localeCompare(a.at || ""))
    .slice(0, 100).map(n => ({ ...n, read: !!receipts[n.id] }));
}
function metrics(orders, rate) {
  const sum = list => list.reduce((n,o) => n + o.total, 0);
  const delivered = sum(orders.filter(o => o.status === "Yetkazildi"));
  return { net: sum(orders.filter(o => o.status !== "Qaytarildi")), delivered,
    refunded: sum(orders.filter(o => o.status === "Qaytarildi")),
    commission: rate == null ? null : Math.round(delivered * rate / 100) };
}
function move(s, p, delta, reason, actor) {
  p.stock += delta;
  s.movements.unshift({
    id: randomUUID(),
    productId: p.id,
    name: p.name,
    supplierId: p.supplierId,
    delta,
    balance: p.stock,
    reason,
    actor,
    at: new Date().toISOString(),
  });
}
function contact(body) {
  const c = {
    customer: str(body.customer, 100),
    city: str(body.city, 100),
    address: str(body.address),
    phone: str(body.phone, 30),
    contact: str(body.contact, 100),
    notes: str(body.notes, 500),
  };
  requireThat(
    c.customer && c.city && c.address && c.contact,
    "Do‘kon, aloqa shaxsi, shahar va manzilni kiriting.",
  );
  requireThat(
    /^\+?[\d\s()-]{9,25}$/.test(c.phone),
    "Telefon raqamini to‘g‘ri kiriting.",
  );
  return c;
}
export function mutate(s, u, action, b) {
  const manager = u.role === "supplier" || u.role === "admin";
  if (action === "notifications:read") {
    requireThat(Array.isArray(b.ids) && b.ids.length <= 100, "Bildirishnomalarni tanlang.");
    const visible = new Set(notifications(s, u).map(n => n.id));
    s.notificationReads ||= {};
    const reads = s.notificationReads[u.id] ||= {};
    for (const id of b.ids) if (visible.has(id)) reads[id] = new Date().toISOString();
    return { notifications: notifications(s, u) };
  }
  if (action === "settings") {
    requireThat(u.role === "admin", "Faqat admin sozlamalarni o‘zgartiradi.", 403);
    requireThat(b.commissionRate === null || (typeof b.commissionRate === "number" &&
      Number.isFinite(b.commissionRate) && b.commissionRate >= 0 && b.commissionRate <= 100), "Komissiya 0–100% bo‘lsin.");
    s.settings ||= { categories: [...CATEGORIES] };
    s.settings.commissionRate = b.commissionRate;
    return s.settings;
  }
  if (action === "cart") {
    requireThat(u.role === "retailer", "Faqat do‘konchi savatidan foydalanadi.", 403);
    requireThat(typeof b.productId === "string" && Number.isSafeInteger(b.quantity) && b.quantity >= 0, "Savat miqdori noto‘g‘ri.");
    s.carts ||= {};
    const cart = s.carts[u.id] ||= {};
    if (!b.quantity) { delete cart[b.productId]; return { cart }; }
    const p = s.products.find(p => p.id === b.productId);
    requireThat(p?.active && s.suppliers.some(x => x.id === p.supplierId && x.active), "Mahsulot mavjud emas.");
    requireThat(b.quantity >= p.minOrder && b.quantity <= p.stock, "Minimal miqdor yoki ombor qoldig‘ini tekshiring.");
    requireThat(Object.keys(cart).length < 100 || cart[p.id], "Savatda 100 tagacha mahsulot bo‘lishi mumkin.");
    cart[p.id] = b.quantity;
    return { cart };
  }

  const ownProduct = (id) => {
    const p = s.products.find((x) => x.id === id);
    requireThat(
      p && (u.role === "admin" || p.supplierId === u.supplierId),
      "Mahsulot topilmadi.",
      404,
    );
    return p;
  };
  if (action === "orders") {
    requireThat(
      u.role !== "admin",
      "Admin yangi savdo buyurtmasi yaratmaydi.",
      403,
    );
    requireThat(
      Array.isArray(b.lines) && b.lines.length > 0 && b.lines.length <= 100,
      "Savat bo‘sh yoki juda katta.",
    );
    const delivery = b.delivery;
    requireThat(
      ["supplier", "platform"].includes(delivery),
      "Yetkazib beruvchini tanlang.",
    );
    const c = contact(b),
      quantities = new Map();
    for (const l of b.lines) {
      requireThat(
        Number.isSafeInteger(l.quantity) && l.quantity > 0,
        "Miqdor musbat butun son bo‘lsin.",
      );
      quantities.set(
        l.productId,
        (quantities.get(l.productId) || 0) + l.quantity,
      );
    }
    const groups = new Map();
    for (const [id, quantity] of quantities) {
      const p = s.products.find((x) => x.id === id),
        sup = s.suppliers.find((x) => x.id === p?.supplierId);
      requireThat(
        p?.active && sup?.active,
        "Mahsulot yoki optomchi faol emas.",
      );
      requireThat(
        u.role === "retailer" || p.supplierId === u.supplierId,
        "Boshqa optomchining mahsulotiga ruxsat yo‘q.",
        403,
      );
      requireThat(
        quantity >= p.minOrder,
        `${p.name}: eng kam miqdor ${p.minOrder} dona.`,
      );
      requireThat(
        quantity <= p.stock,
        `${p.name}: omborda ${p.stock} dona mavjud.`,
      );
      if (!groups.has(p.supplierId)) groups.set(p.supplierId, []);
      groups
        .get(p.supplierId)
        .push({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          price: p.price,
          quantity,
        });
    }
    for (const lines of groups.values())
      requireThat(
        Number.isSafeInteger(totalOf(lines)),
        "Buyurtma summasi juda katta.",
      );
    let store =
      u.role === "retailer"
        ? s.stores.find((x) => x.id === u.storeId)
        : b.storeId ? s.stores.find(x => x.id === b.storeId) : s.stores.find(
            (x) => x.name.toLocaleLowerCase() === c.customer.toLocaleLowerCase(),
          );
    if (u.role === "supplier" && b.storeId) requireThat(store, "Do‘kon topilmadi.", 404);
    if (!store) {
      store = { id: randomUUID(), name: c.customer, ...c };
      s.stores.push(store);
    }
    const result = [];
    for (const [supplierId, lines] of groups) {
      const at = new Date().toISOString(),
        order = {
          id: s.nextOrder++,
          supplierId,
          storeId: store.id,
          ...c,
          lines,
          total: totalOf(lines),
          status: "Yangi",
          delivery,
          date: at,
          history: [{ status: "Yangi", at, actor: u.name }],
        };
      s.orders.unshift(order);
      result.push(order);
      for (const l of lines)
        move(
          s,
          s.products.find((p) => p.id === l.productId),
          -l.quantity,
          `Buyurtma #${order.id}`,
          u.name,
        );
    }
    if (u.role === "retailer" && s.carts) s.carts[u.id] = {};
    return { orders: result };
  }
  if (action.startsWith("order:")) {
    const [, id, operation] = action.split(":"),
      o = s.orders.find((x) => x.id === Number(id));
    requireThat(
      o &&
        (u.role === "admin" ||
          (u.role === "supplier" && o.supplierId === u.supplierId)),
      "Buyurtmaga ruxsat yo‘q.",
      403,
    );
    if (operation === "status") {
      requireThat(
        !["Yetkazildi", "Qaytarildi"].includes(o.status),
        "Yakunlangan buyurtma holatini o‘zgartirib bo‘lmaydi.",
        409,
      );
      requireThat(
        STATUS.indexOf(b.status) === STATUS.indexOf(o.status) + 1,
        "Faqat keyingi bosqichga o‘tish mumkin.",
        409,
      );
      requireThat(
        !(
          u.role === "supplier" &&
          o.delivery === "platform" &&
          o.status !== "Yangi"
        ),
        "Rasta yetkazishini admin boshqaradi.",
        403,
      );
      o.status = b.status;
      o.history.push({
        status: o.status,
        at: new Date().toISOString(),
        actor: u.name,
      });
      return o;
    }
    if (operation === "refund") {
      requireThat(
        o.status === "Yetkazildi",
        "Faqat yetkazilgan buyurtma bir marta qaytariladi.",
        409,
      );
      requireThat(
        str(b.reason).length >= 5,
        "Qaytarish sababini kiriting (kamida 5 belgi).",
      );
      o.status = "Qaytarildi";
      o.refund = {
        reason: str(b.reason),
        amount: o.total,
        restock: b.restock === true,
        at: new Date().toISOString(),
        actor: u.name,
      };
      if (o.refund.restock)
        for (const l of o.lines)
          move(
            s,
            s.products.find((p) => p.id === l.productId),
            l.quantity,
            `Qaytarish #${o.id}`,
            u.name,
          );
      o.history.push({ status: "Qaytarildi", at: o.refund.at, actor: u.name });
      return o;
    }
    if (operation === "assign") {
      requireThat(
        u.role === "admin" && o.delivery === "platform",
        "Faqat Rasta yetkazishini tayinlash mumkin.",
        403,
      );
      requireThat(
        !["Yetkazildi", "Qaytarildi"].includes(o.status),
        "Buyurtma yakunlangan.",
        409,
      );
      requireThat(str(b.courier).length > 1, "Kuryer ismini kiriting.");
      o.courier = str(b.courier);
      return o;
    }
    throw new AppError("Amal topilmadi.", 404);
  }
  if (action === "product" || action.startsWith("product:")) {
    requireThat(
      u.role === "supplier",
      "Faqat optomchi mahsulotni tahrirlaydi.",
      403,
    );
    const existing = action.includes(":")
      ? ownProduct(action.split(":")[1])
      : null;
    const p = validateProduct({
      ...b,
      stock: existing ? existing.stock : b.stock,
    });
    requireThat(
      !s.products.some(
        (x) =>
          x.supplierId === u.supplierId &&
          x.sku === p.sku &&
          x.id !== existing?.id,
      ),
      "Bu SKU allaqachon mavjud.",
      409,
    );
    if (existing) {
      Object.assign(existing, p, { active: b.active !== false });
      return existing;
    }
    const next = {
      ...p,
      id: randomUUID(),
      supplierId: u.supplierId,
      active: b.active !== false,
      emoji: "📦",
      color: "green",
      stock: 0,
    };
    s.products.push(next);
    move(s, next, p.stock, "Boshlang‘ich kirim", u.name);
    return next;
  }
  if (action === "stock") {
    requireThat(manager, "Ruxsat yo‘q.", 403);
    const p = ownProduct(b.productId),
      delta = Number(b.quantity);
    requireThat(
      Number.isSafeInteger(delta) &&
        delta !== 0 &&
        Math.abs(delta) <= 1e7 &&
        p.stock + delta >= 0,
      "Miqdor noto‘g‘ri yoki qoldiq yetarli emas.",
    );
    requireThat(
      str(b.reason).length >= 3,
      "Kirim yoki chiqim sababini kiriting.",
    );
    move(s, p, delta, str(b.reason), u.name);
    return p;
  }
  if (action === "import") {
    requireThat(u.role === "supplier", "Faqat optomchi import qiladi.", 403);
    requireThat(
      Array.isArray(b.products) &&
        b.products.length > 0 &&
        b.products.length <= 1000,
      "Import 1–1000 mahsulotdan iborat bo‘lsin.",
    );
    const rows = b.products.map(validateProduct);
    requireThat(
      new Set(rows.map((p) => p.sku)).size === rows.length,
      "Faylda takrorlangan SKU bor.",
    );
    for (const p of rows) {
      let item = s.products.find(
        (x) => x.supplierId === u.supplierId && x.sku === p.sku,
      );
      if (item) {
        const diff = p.stock - item.stock;
        Object.assign(item, { ...p, stock: item.stock });
        if (diff)
          move(s, item, diff, "Import orqali qoldiq yangilandi", u.name);
      } else {
        item = {
          ...p,
          id: randomUUID(),
          supplierId: u.supplierId,
          active: true,
          emoji: "📦",
          color: "green",
          stock: 0,
        };
        s.products.push(item);
        move(s, item, p.stock, "Import orqali kirim", u.name);
      }
    }
    const log = {
      id: randomUUID(),
      supplierId: u.supplierId,
      count: rows.length,
      source: b.source === "api" ? "API sinxronlash" : "CSV import",
      at: new Date().toISOString(),
    };
    s.imports.unshift(log);
    return log;
  }
  if (action === "supplier:toggle") {
    requireThat(u.role === "admin", "Ruxsat yo‘q.", 403);
    const p = s.suppliers.find((x) => x.id === b.id);
    requireThat(p, "Optomchi topilmadi.", 404);
    p.active = !p.active;
    return p;
  }
  if (action === "profile") {
    requireThat(str(b.name).length >= 2, "Ismni kiriting.");
    u.name = str(b.name, 100);
    if (u.role === "retailer") {
      const store = s.stores.find((x) => x.id === u.storeId),
        c = contact({ ...b, customer: b.storeName });
      Object.assign(store, { name: c.customer, ...c });
    }
    return publicUser(u);
  }
  throw new AppError("Amal topilmadi.", 404);
}
