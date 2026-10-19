import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/api/server.mjs";
import { parseCSV } from "../packages/domain/index.js";
let app, base, dir, db;
const sessions = {};
async function api(role, path, body, method = "POST", token = sessions[role]) {
  const r = await fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : method,
    headers: {
      "Content-Type": "application/json",
      "X-Rasta-App": role,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, body: await r.json() };
}
const contact = {
  customer: "Test Market",
  contact: "Test Mijoz",
  city: "Toshkent",
  phone: "+998901234567",
  address: "Test ko‘chasi, 10",
};
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "rasta-test-"));
  db = join(dir, "test.sqlite");
  app = createApp({ database: db, demo: true });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + app.address().port;
  for (const [role, email] of [
    ["supplier", "optom@rasta.uz"],
    ["admin", "admin@rasta.uz"],
    ["retailer", "dokon@rasta.uz"],
  ]) {
    const r = await api(role, "/login", {
      email,
      password: "RastaDemo2026!",
      native: true,
    });
    assert.equal(r.status, 200);
    sessions[role] = r.body.token;
  }
});
after(async () => {
  await new Promise((r) => app.close(r));
  await rm(dir, { recursive: true, force: true });
});
test("authentication and role boundaries", async () => {
  assert.equal(
    (await api("admin", "/state", undefined, "GET", sessions.supplier)).status,
    401,
  );
  assert.equal(
    (
      await api("supplier", "/login", {
        email: "optom@rasta.uz",
        password: "wrong",
      })
    ).status,
    401,
  );
  const s = (await api("supplier", "/state")).body;
  assert.ok(s.products.every((p) => p.supplierId === "sup-orzu"));
  assert.ok(s.orders.every((o) => o.supplierId === "sup-orzu"));
  assert.equal(JSON.stringify(s).includes("passwordHash"), false);
  assert.equal(
    (await api("retailer", "/products", { name: "Nope" })).status,
    403,
  );
  assert.equal(
    (await api("supplier", "/products/p5", { name: "Nope" }, "PATCH")).status,
    404,
  );
});
test("mixed-supplier cart creates scoped orders and deducts stock atomically", async () => {
  const r = await api("retailer", "/orders", {
    ...contact,
    delivery: "platform",
    lines: [
      { productId: "p1", quantity: 6 },
      { productId: "p5", quantity: 12 },
    ],
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.orders.length, 2);
  assert.equal(r.body.orders[0].phone, contact.phone);
  const s = (await api("retailer", "/state")).body;
  assert.equal(s.products.find((p) => p.id === "p1").stock, 242);
  assert.equal(s.products.find((p) => p.id === "p5").stock, 114);
});
test("insufficient stock, fractional quantity and minimum quantity fail with no partial deduction", async () => {
  const before = (await api("retailer", "/state")).body;
  for (const lines of [
    [
      { productId: "p1", quantity: 6 },
      { productId: "p5", quantity: 99999 },
    ],
    [{ productId: "p1", quantity: 1.2 }],
    [{ productId: "p1", quantity: 1 }],
  ]) {
    assert.equal(
      (
        await api("retailer", "/orders", {
          ...contact,
          delivery: "supplier",
          lines,
        })
      ).status,
      400,
    );
  }
  const after = (await api("retailer", "/state")).body;
  assert.deepEqual(after.products, before.products);
  assert.equal(after.orders.length, before.orders.length);
});
test("existing store selection and new store creation", async () => {
  const b = {
    ...contact,
    customer: "New Test Shop",
    delivery: "supplier",
    lines: [{ productId: "p2", quantity: 12 }],
  };
  const first = await api("supplier", "/orders", b);
  assert.equal(first.status, 200);
  await api("supplier", "/orders", b);
  const s = (await api("supplier", "/state")).body;
  assert.equal(s.stores.filter((x) => x.name === "New Test Shop").length, 1);
  assert.equal(
    s.stores.find((x) => x.name === "New Test Shop").phone,
    contact.phone,
  );
});
test("platform delivery requires admin after preparation; delivered is locked and refund is one-time", async () => {
  let r = await api("supplier", "/orders/10482/status", {
    status: "Yetkazildi",
  });
  assert.equal(r.status, 409);
  assert.equal(
    (
      await api("supplier", "/orders/10482/status", {
        status: "Tayyorlanmoqda",
      })
    ).status,
    200,
  );
  assert.equal(
    (await api("supplier", "/orders/10482/status", { status: "Yetkazilmoqda" }))
      .status,
    403,
  );
  assert.equal(
    (
      await api("admin", "/orders/10482/assign", {
        courier: "Ali +998901112233",
      })
    ).status,
    200,
  );
  assert.equal(
    (await api("admin", "/orders/10482/status", { status: "Yetkazilmoqda" }))
      .status,
    200,
  );
  assert.equal(
    (await api("admin", "/orders/10482/status", { status: "Yetkazildi" }))
      .status,
    200,
  );
  assert.equal(
    (await api("admin", "/orders/10482/status", { status: "Yangi" })).status,
    409,
  );
  const stock = (await api("supplier", "/state")).body.products.find(
    (p) => p.id === "p1",
  ).stock;
  assert.equal(
    (
      await api("supplier", "/orders/10482/refund", {
        reason: "Qadoq shikastlangan",
        restock: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api("supplier", "/orders/10482/refund", {
        reason: "Takroran",
        restock: true,
      })
    ).status,
    409,
  );
  const s = (await api("supplier", "/state")).body;
  assert.equal(s.products.find((p) => p.id === "p1").stock, stock + 12);
  assert.equal(s.orders.find((o) => o.id === 10482).status, "Qaytarildi");
  assert.equal(
    (await api("retailer", "/orders/10479/refund", { reason: "No access" }))
      .status,
    403,
  );
});
test("CSV quoting and all-or-nothing validation", async () => {
  const rows = parseCSV(
    '\uFEFFsku,name,price,stock,minOrder,category,size\r\nA1,"Olma, sharbat",12000,50,6,Ichimliklar,1 litr',
  );
  assert.equal(rows[0].name, "Olma, sharbat");
  assert.equal(
    (
      await api("supplier", "/import", {
        products: [rows[0], { sku: "INVALID" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (await api("supplier", "/state")).body.products.some((p) => p.sku === "A1"),
    false,
  );
  assert.equal(
    (await api("supplier", "/import", { products: rows })).status,
    200,
  );
  assert.equal(
    (await api("supplier", "/import", { products: [rows[0], rows[0]] })).status,
    400,
  );
  assert.equal(
    (
      await api("supplier", "/import", {
        products: [{ ...rows[0], stock: 80 }],
      })
    ).status,
    200,
  );
  const s = (await api("supplier", "/state")).body;
  assert.equal(s.products.filter((p) => p.sku === "A1").length, 1);
  assert.equal(s.products.find((p) => p.sku === "A1").stock, 80);
});
test("API keys are supplier-scoped and rotation revokes old key", async () => {
  const first = (await api("supplier", "/integrations/key", {})).body.key;
  const second = (await api("supplier", "/integrations/key", {})).body.key;
  const payload = {
    products: [
      {
        sku: "SYNC",
        name: "Sync product",
        price: 5000,
        stock: 30,
        minOrder: 1,
      },
    ],
  };
  assert.equal(
    (await api("supplier", "/integrations/sync", payload, "POST", first))
      .status,
    401,
  );
  assert.equal(
    (await api("supplier", "/integrations/sync", payload, "POST", second))
      .status,
    200,
  );
  const s = (await api("supplier", "/state")).body;
  assert.equal(s.products.find((p) => p.sku === "SYNC").supplierId, "sup-orzu");
  assert.ok(s.integration[0].lastSync);
  assert.equal(JSON.stringify(s).includes("keyHash"), false);
});
test("disabled supplier is hidden and cannot receive new orders", async () => {
  assert.equal(
    (await api("admin", "/suppliers/toggle", { id: "sup-baraka" })).status,
    200,
  );
  assert.equal(
    (await api("retailer", "/state")).body.products.some(
      (p) => p.supplierId === "sup-baraka",
    ),
    false,
  );
  assert.equal(
    (
      await api("retailer", "/orders", {
        ...contact,
        delivery: "platform",
        lines: [{ productId: "p5", quantity: 12 }],
      })
    ).status,
    400,
  );
  await api("admin", "/suppliers/toggle", { id: "sup-baraka" });
});
test("retailer registration, profile and password update", async () => {
  const register = {
    email: "new@example.test",
    password: "LongPassword123!",
    name: "Yangi Mijoz",
    storeName: "Yangi Market",
    city: "Navoiy",
    address: "Navro‘z 12",
    phone: "+998901234599",
  };
  assert.equal((await api("retailer", "/register", register)).status, 201);
  assert.equal((await api("retailer", "/register", register)).status, 409);
  const login = await api("retailer", "/login", { ...register, native: true });
  const token = login.body.token;
  const data = (await api("retailer", "/state", undefined, "GET", token)).body;
  assert.equal(data.orders.length, 0);
  assert.equal(data.stores.length, 1);
  assert.equal(
    (
      await api(
        "retailer",
        "/password",
        { current: register.password, password: "ChangedPassword123!" },
        "POST",
        token,
      )
    ).status,
    200,
  );
  assert.equal((await api("retailer", "/login", { ...register })).status, 401);
  assert.equal(
    (await api("retailer", "/logout", {}, "POST", token)).status,
    200,
  );
  assert.equal(
    (await api("retailer", "/state", undefined, "GET", token)).status,
    401,
  );
});
test("admin onboards supplier with an isolated empty catalog", async () => {
  const body = {
    name: "Test Supplier",
    city: "Buxoro",
    phone: "+998902223344",
    email: "supplier-new@example.test",
    password: "LongSupplierPassword123!",
  };
  assert.equal((await api("supplier", "/suppliers", body)).status, 403);
  assert.equal((await api("admin", "/suppliers", body)).status, 201);
  const login = await api("supplier", "/login", {
    email: body.email,
    password: body.password,
    native: true,
  });
  assert.equal(login.status, 200);
  const data = (
    await api("supplier", "/state", undefined, "GET", login.body.token)
  ).body;
  assert.equal(data.products.length, 0);
  assert.equal(data.orders.length, 0);
  assert.equal((await api("admin", "/suppliers", body)).status, 409);
});
test("database persists on server restart", async () => {
  const before = (await api("admin", "/state")).body;
  await new Promise((r) => app.close(r));
  app = createApp({ database: db, demo: false });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + app.address().port;
  const after = (await api("admin", "/state")).body;
  assert.deepEqual(after.orders, before.orders);
  assert.deepEqual(after.products, before.products);
});

test("duplicate store names retain the selected store identity", async () => {
 const account = {email:"duplicate-store@example.test",password:"StoreIdentity123!",name:"Ikkinchi Mijoz",storeName:"Baraka Market",phone:"+998901111111",city:"Navoiy",address:"Navro‘z 8"};
 assert.equal((await api("retailer","/register",account)).status,201);
 const token=(await api("retailer","/login",{...account,native:true})).body.token;
 const store=(await api("retailer","/state",undefined,"GET",token)).body.stores[0];
 const created=await api("supplier","/orders",{...contact,customer:store.name,storeId:store.id,delivery:"supplier",lines:[{productId:"p1",quantity:6}]});
 assert.equal(created.status,200);assert.equal(created.body.orders[0].storeId,store.id);
 assert.equal((await api("retailer","/state",undefined,"GET",token)).body.orders.length,1);
});

test("notification reads are scoped, persisted, and new events become unread", async () => {
  const before = (await api("supplier", "/state")).body;
  assert.ok(before.notifications.some(n => !n.read));
  const ids = before.notifications.map(n => n.id);
  assert.equal((await api("supplier", "/notifications/read", {ids})).status, 200);
  assert.ok((await api("supplier", "/state")).body.notifications.every(n => n.read));
  assert.ok((await api("admin", "/state")).body.notifications.some(n => !n.read));
  await api("supplier", "/orders", {...contact, delivery:"supplier", lines:[{productId:"p1", quantity:6}]});
  const next = (await api("supplier", "/state")).body.notifications;
  assert.ok(next.some(n => !ids.includes(n.id) && !n.read));
  assert.ok(next.filter(n => ids.includes(n.id)).every(n => n.read));
  await new Promise(r => app.close(r));
  app = createApp({database:db}); await new Promise(r => app.listen(0,"127.0.0.1",r));
  base = "http://127.0.0.1:" + app.address().port;
  assert.deepEqual((await api("supplier", "/state")).body.notifications, next);
});
test("retailer cart is server persisted, isolated, validated and cleared atomically on checkout", async () => {
  const update = body => api("retailer", "/cart", body, "PATCH");
  assert.equal((await update({productId:"p1",quantity:6})).status,200);
  assert.equal((await api("retailer", "/state")).body.cart.p1,6);
  assert.equal((await update({productId:"p1",quantity:999999})).status,400);
  assert.equal((await update({productId:"p1",quantity:1.2})).status,400);
  assert.equal((await api("supplier","/cart",{productId:"p1",quantity:6},"PATCH")).status,403);
  assert.equal((await api("supplier", "/state")).body.cart,undefined);
  const other=(await api("retailer","/login",{email:"duplicate-store@example.test",password:"StoreIdentity123!",native:true})).body.token;
  assert.deepEqual((await api("retailer","/state",undefined,"GET",other)).body.cart,{});
  await new Promise(r => app.close(r));
  app=createApp({database:db});await new Promise(r=>app.listen(0,"127.0.0.1",r));base="http://127.0.0.1:"+app.address().port;
  assert.equal((await api("retailer","/state")).body.cart.p1,6);
  assert.equal((await api("retailer","/orders",{...contact,delivery:"platform",lines:[{productId:"p1",quantity:999999}]})).status,400);
  assert.equal((await api("retailer","/state")).body.cart.p1,6);
  assert.equal((await api("retailer","/orders",{...contact,delivery:"platform",lines:[{productId:"p1",quantity:6}]})).status,200);
  assert.deepEqual((await api("retailer","/state")).body.cart,{});
});
test("commission is explicitly configured by admin and calculated by API", async () => {
  const initial=(await api("admin","/state")).body;
  assert.equal(initial.metrics.commission,null);
  assert.ok(initial.categories.length);
  assert.ok(Date.parse(initial.session.expiresAt)>Date.now());
  assert.equal((await api("supplier","/settings",{commissionRate:2},"PATCH")).status,403);
  assert.equal((await api("admin","/settings",{commissionRate:101},"PATCH")).status,400);
  assert.equal((await api("admin","/settings",{commissionRate:2.5},"PATCH")).status,200);
  const s=(await api("supplier","/state")).body;
  assert.equal(s.settings.commissionRate,2.5);
  assert.equal(s.metrics.commission,Math.round(s.metrics.delivered*0.025));
  await api("admin","/settings",{commissionRate:null},"PATCH");
});
test("fresh production database has no seeded business data", async () => {
  const oldEmail=process.env.ADMIN_EMAIL, oldPassword=process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL="owner@example.test";process.env.ADMIN_PASSWORD="ProductionTest2026!";
  const server=createApp({database:join(dir,"empty.sqlite"),demo:false});
  try {
    await new Promise(r=>server.listen(0,"127.0.0.1",r));
    const url="http://127.0.0.1:"+server.address().port+"/api";
    const login=await fetch(url+"/login",{method:"POST",headers:{"Content-Type":"application/json","X-Rasta-App":"admin"},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,native:true})});
    const {token}=await login.json();
    const state=await (await fetch(url+"/state",{headers:{Authorization:"Bearer "+token,"X-Rasta-App":"admin"}})).json();
    for(const key of ["products","orders","suppliers","stores","notifications"]) assert.deepEqual(state[key],[]);
    assert.equal(state.metrics.net,0);
  } finally { await new Promise(r=>server.close(r));
    if(oldEmail===undefined) delete process.env.ADMIN_EMAIL;else process.env.ADMIN_EMAIL=oldEmail;
    if(oldPassword===undefined) delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=oldPassword;
  }
});
