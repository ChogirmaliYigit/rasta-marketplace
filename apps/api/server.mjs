import http from "node:http";
import { isIP } from "node:net";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { seed } from "./seed.mjs";
import { AppError, mutate, snapshot, publicUser } from "./domain.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 32).toString("hex");
}
function verify(password, encoded) {
  const [salt, h] = encoded.split(":");
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(h, "hex"));
}
const digest = (x) => createHash("sha256").update(x).digest("hex");
const roles = ["supplier", "retailer", "admin"];
const safeUser = (u) => publicUser(u);
export function createApp({
  database = process.env.DATABASE_PATH || resolve(root, "data/rasta.sqlite"),
  demo = process.env.SEED_DEMO === "true",
} = {}) {
  if (demo && process.env.NODE_ENV === "production") throw new Error("Production muhitida demo ma’lumot yaratish taqiqlangan.");
  if (process.env.NODE_ENV === "production") {
    if (process.env.COOKIE_SECURE !== "true") throw new Error("Production uchun COOKIE_SECURE=true kerak.");
    const origins = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
    if (!origins.length || origins.some(o => { try { const u = new URL(o); return u.protocol !== "https:" || u.origin !== o; } catch { return true; } }))
      throw new Error("Production uchun ALLOWED_ORIGINS aniq HTTPS originlardan iborat bo‘lsin.");
  }
  if (database !== ":memory:")
    mkdirSync(dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT NOT NULL,expires INTEGER NOT NULL);",
  );
  if (!db.prepare("SELECT id FROM state").get()) {
    let initial;
    if (demo) initial = seed(hash);
    else {
      const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD || "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128)
        throw new Error("Yangi baza uchun ADMIN_EMAIL va ADMIN_PASSWORD (12–128 belgi) kiriting. Sinov bazasi uchun SEED_DEMO=true ishlating.");
      initial = { users: [{ id: randomUUID(), name: process.env.ADMIN_NAME || "Administrator", email, role: "admin", passwordHash: hash(password) }],
        suppliers: [], stores: [], products: [], orders: [], movements: [], imports: [], integrations: [], nextOrder: 10001 };
    }
    db.prepare("INSERT INTO state VALUES(1,?)").run(JSON.stringify(initial));
  }
  const read = () =>
    JSON.parse(db.prepare("SELECT data FROM state WHERE id=1").get().data);
  const save = (s) =>
    db.prepare("UPDATE state SET data=? WHERE id=1").run(JSON.stringify(s));
  const transactions = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const s = read(),
        result = fn(s);
      save(s);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const allowed = new Set(
    (
      process.env.ALLOWED_ORIGINS ||
      "http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174,http://localhost:8081,http://127.0.0.1:8081,http://127.0.0.1:4180"
    ).split(","),
  );
  const failures = new Map();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost"),
      path = url.pathname,
      origin = req.headers.origin;
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Rasta-App, Idempotency-Key",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, OPTIONS",
      );
      res.writeHead(204);
      return res.end();
    }
    try {
      if (!path.startsWith("/api/")) {
        if (process.env.API_ONLY === "true") throw new AppError("Topilmadi.", 404);
        let base = resolve(root, "apps/wholesaler/dist"),
          relative = path;
        if (path.startsWith("/admin")) {
          base = resolve(root, "apps/admin/dist");
          relative = path.slice(6);
        } else if (path.startsWith("/mobile")) {
          base = resolve(root, "apps/mobile/dist");
          relative = path.slice(7);
        }
        let file = resolve(base, "." + decodeURIComponent(relative || "/"));
        if (!file.startsWith(base + sep) && file !== base)
          throw new AppError("Topilmadi.", 404);
        if (!extname(file)) file = resolve(base, "index.html");
        if (!existsSync(file))
          throw new AppError("Avval pnpm build bajaring.", 404);
        const type =
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".json": "application/json",
            ".ttf": "font/ttf",
            ".woff2": "font/woff2",
          }[extname(file)] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": type,
          "Cache-Control":
            extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
        });
        return res.end(readFileSync(file));
      }
      if (path === "/api/health") return send(200, { ok: true });
      if (origin && !allowed.has(origin))
        throw new AppError("Origin ruxsat etilmagan.", 403);
      let body = {};
      if (["POST", "PATCH"].includes(req.method)) {
        let text = "";
        for await (const chunk of req) {
          text += chunk;
          if (Buffer.byteLength(text) > 2e6)
            throw new AppError("Fayl 2 MB dan oshmasin.", 413);
        }
        try {
          body = JSON.parse(text || "{}");
        } catch {
          throw new AppError("JSON noto‘g‘ri.");
        }
        if (!body || Array.isArray(body) || typeof body !== "object")
          throw new AppError("JSON obyekt kutilgan.");
      }
      const app = roles.includes(req.headers["x-rasta-app"])
        ? req.headers["x-rasta-app"]
        : "supplier";
      const cookie = String(req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("rasta_" + app + "="))
        ?.split("=")[1];
      const bearer = String(req.headers.authorization || "").startsWith(
        "Bearer ",
      )
        ? req.headers.authorization.slice(7)
        : null;
      const token = bearer || cookie;
      const setCookie = (t, maxAge) =>
        res.setHeader(
          "Set-Cookie",
          `rasta_${app}=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
        );
      if (path === "/api/register" && req.method === "POST") {
        if (app !== "retailer")
          throw new AppError("Faqat do‘konchi ro‘yxatdan o‘tishi mumkin.", 403);
        const email = String(body.email || "")
            .trim()
            .toLowerCase(),
          password = String(body.password || "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
          throw new AppError("Email noto‘g‘ri.");
        if (password.length < 12 || password.length > 128)
          throw new AppError("Parol 12–128 belgi bo‘lsin.");
        for (const key of ["name", "storeName", "city", "address"])
          if (
            typeof body[key] !== "string" ||
            !body[key].trim() ||
            body[key].length > 200
          )
            throw new AppError("Ism, do‘kon, shahar va manzilni to‘ldiring.");
        if (!/^\+?[\d\s()-]{9,25}$/.test(body.phone || ""))
          throw new AppError("Telefon raqami noto‘g‘ri.");
        transactions((s) => {
          if (s.users.some((u) => u.email === email))
            throw new AppError("Bu email bilan akkaunt mavjud.", 409);
          const store = {
            id: randomUUID(),
            name: body.storeName.trim(),
            contact: body.name.trim(),
            city: body.city.trim(),
            address: body.address.trim(),
            phone: body.phone.trim(),
          };
          s.stores.push(store);
          s.users.push({
            id: randomUUID(),
            name: body.name.trim(),
            email,
            role: "retailer",
            storeId: store.id,
            passwordHash: hash(password),
          });
        });
        return send(201, { ok: true });
      }
      if (path === "/api/login" && req.method === "POST") {
        const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
        const key = process.env.TRUST_PROXY === "true" && isIP(forwarded) ? forwarded : req.socket.remoteAddress,
          f = failures.get(key) || { count: 0, at: Date.now() };
        if (Date.now() - f.at > 60000) {
          f.count = 0;
          f.at = Date.now();
        }
        if (f.count >= 12)
          throw new AppError("Bir daqiqadan so‘ng qayta urinib ko‘ring.", 429);
        const s = read(),
          u = s.users.find(
            (x) =>
              x.email ===
                String(body.email || "")
                  .trim()
                  .toLowerCase() && x.role === app,
          );
        if (!u || !verify(String(body.password || ""), u.passwordHash)) {
          f.count++;
          failures.set(key, f);
          throw new AppError("Email yoki parol noto‘g‘ri.", 401);
        }
        const t = randomBytes(32).toString("hex");
        db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          digest(t),
          u.id,
          Date.now() + 86400000,
        );
        failures.delete(key);
        setCookie(t, 86400);
        return send(200, {
          user: safeUser(u),
          ...(body.native === true ? { token: t } : {}),
        });
      }
      const session =
        token &&
        db
          .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
          .get(digest(token), Date.now());
      if (path === "/api/integrations/sync" && req.method === "POST") {
        if (!bearer) throw new AppError("API kalit kerak.", 401);
        const result = transactions((s) => {
          const i = s.integrations.find((x) => x.keyHash === digest(bearer)),
            u = s.users.find(
              (x) => x.role === "supplier" && x.supplierId === i?.supplierId,
            );
          if (
            !i ||
            !u ||
            !s.suppliers.find((x) => x.id === u.supplierId)?.active
          )
            throw new AppError("API kalit faol emas.", 401);
          i.lastSync = new Date().toISOString();
          return mutate(s, u, "import", { ...body, source: "api" });
        });
        return send(200, result);
      }
      const s = read(),
        u = s.users.find((x) => x.id === session?.userId);
      if (!u || u.role !== app)
        throw new AppError("Akkauntingizga kiring.", 401);
      if (path === "/api/logout" && req.method === "POST") {
        db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
        setCookie("", 0);
        return send(200, { ok: true });
      }
      if (path === "/api/state" && req.method === "GET")
        return send(200, { ...snapshot(s, u), session: { expiresAt: new Date(session.expires).toISOString() } });
      if (u.mustChangePassword && !(path === "/api/password" && req.method === "POST"))
        throw new AppError("Davom etish uchun demo parolni shaxsiy parolga almashtiring.", 403);
      if (
        u.role === "supplier" &&
        !s.suppliers.find((x) => x.id === u.supplierId)?.active
      )
        throw new AppError(
          "Optomchi faoliyati to‘xtatilgan. Rasta adminiga murojaat qiling.",
          403,
        );
      if (path === "/api/suppliers" && req.method === "POST") {
        if (u.role !== "admin")
          throw new AppError("Faqat admin optomchi qo‘shadi.", 403);
        const email = String(body.email || "")
            .trim()
            .toLowerCase(),
          password = String(body.password || "");
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          password.length < 12 ||
          password.length > 128
        )
          throw new AppError("Email va kamida 12 belgili parol kerak.");
        for (const key of ["name", "city", "phone"])
          if (!String(body[key] || "").trim())
            throw new AppError("Nomi, shahar va telefonni kiriting.");
        const result = transactions((s) => {
          if (s.users.some((x) => x.email === email))
            throw new AppError("Email band.", 409);
          const supplier = {
            id: randomUUID(),
            name: String(body.name).trim().slice(0, 100),
            city: String(body.city).trim().slice(0, 100),
            phone: String(body.phone).trim().slice(0, 30),
            description: String(body.description || "").slice(0, 300),
            active: true,
          };
          s.suppliers.push(supplier);
          s.users.push({
            id: randomUUID(),
            name: supplier.name,
            email,
            role: "supplier",
            supplierId: supplier.id,
            passwordHash: hash(password),
          });
          return supplier;
        });
        return send(201, result);
      }
      if (path === "/api/integrations/key" && req.method === "POST") {
        if (u.role !== "supplier") throw new AppError("Ruxsat yo‘q.", 403);
        const key = "rst_" + randomBytes(32).toString("hex");
        transactions((s) => {
          s.integrations = s.integrations.filter(
            (i) => i.supplierId !== u.supplierId,
          );
          s.integrations.push({
            supplierId: u.supplierId,
            keyHash: digest(key),
            createdAt: new Date().toISOString(),
            lastSync: null,
          });
        });
        return send(200, { key });
      }
      if (path === "/api/password" && req.method === "POST") {
        if (!verify(String(body.current || ""), u.passwordHash))
          throw new AppError("Joriy parol noto‘g‘ri.");
        if (
          typeof body.password !== "string" ||
          body.password.length < 12 ||
          body.password.length > 128
        )
          throw new AppError("Yangi parol 12–128 belgidan iborat bo‘lsin.");
        if (body.password === "RastaDemo2026!" || verify(body.password, u.passwordHash))
          throw new AppError("Yangi shaxsiy parol kiriting. Avvalgi yoki demo parolni ishlatmang.");
        transactions((s) => {
          const account = s.users.find((x) => x.id === u.id);
          account.passwordHash = hash(body.password);
          account.mustChangePassword = false;
        });
        db.prepare("DELETE FROM sessions WHERE userId=? AND token<>?").run(
          u.id,
          digest(token),
        );
        return send(200, { ok: true });
      }
      const routes = {
        "POST /api/orders": "orders",
        "POST /api/notifications/read": "notifications:read",
        "PATCH /api/cart": "cart",
        "PATCH /api/settings": "settings",
        "POST /api/products": "product",
        "POST /api/stock": "stock",
        "POST /api/import": "import",
        "PATCH /api/profile": "profile",
        "POST /api/suppliers/toggle": "supplier:toggle",
      };
      let action = routes[req.method + " " + path];
      const order = path.match(
          /^\/api\/orders\/(\d+)\/(status|refund|assign)$/,
        ),
        product = path.match(/^\/api\/products\/([^/]+)$/);
      if (req.method === "POST" && order)
        action = `order:${order[1]}:${order[2]}`;
      if (req.method === "PATCH" && product) action = `product:${product[1]}`;
      if (!action) throw new AppError("API manzili topilmadi.", 404);
      const result = transactions((state) =>
        mutate(
          state,
          state.users.find((x) => x.id === u.id),
          action,
          body,
        ),
      );
      send(200, result);
    } catch (e) {
      if (!(e instanceof AppError) && e.name !== "Error") console.error(e);
      send(e.status || 400, {
        error: e.status === 500 ? "Server xatosi." : e.message,
      });
    }
  });
  server.on("close", () => db.close());
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const server = createApp();
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(
      `Rasta: http://${process.env.HOST || "127.0.0.1"}:${port} | /admin/ | /mobile/`,
    ),
  );
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 25000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
