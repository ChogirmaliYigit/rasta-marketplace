import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronRight,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Panel,
  Select,
  Modal,
  Field,
  Empty,
  SearchBox,
  downloadCSV,
} from "./components.jsx";
import {
  STATUS,
  money,
  parseCSV,
  validateProduct,
} from "../domain/index.js";
import "./base.css";
import "./styles.css";
const supplierUrl = import.meta.env.VITE_SUPPLIER_URL || "/";
const adminUrl = import.meta.env.VITE_ADMIN_URL || "/admin/";
const mobileUrl = import.meta.env.VITE_MOBILE_URL ?? "/mobile/";
const roleNames = {
  supplier: "Optomchi",
  admin: "Rasta admin",
  retailer: "Do‘konchi",
};
const deliveryName = (x) =>
  x === "platform" ? "Rasta yetkazadi" : "Optomchi yetkazadi";
const date = (x) => new Date(x).toLocaleString("en-GB", { hour12: false });
const terminal = (o) => ["Yetkazildi", "Qaytarildi"].includes(o.status);
export default function App({ role }) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("Umumiy"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Barchasi"),
    [modal, setModal] = useState(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [popover, setPopover] = useState(""),
    [sidebar, setSidebar] = useState(false),
    [connected, setConnected] = useState(false);
  const popRef = useRef(null),
    timer = useRef(null);
  const api = async (path, body, method = "POST") => {
    const r = await fetch("/api" + path, {
      method: body === undefined ? "GET" : method,
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Rasta-App": role },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = await r.json();
    if (!r.ok) {
      if (r.status === 401) setData(null);
      throw new Error(json.error || "So‘rov bajarilmadi.");
    }
    return json;
  };
  const load = async (quiet = false) => {
    try {
      const state = await api("/state");
      setData(state);
      setConnected(true);
      if (!quiet) setError("");
    } catch (e) {
      setConnected(false);
      if (!quiet && e.message !== "Akkauntingizga kiring.") setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const close = (e) => {
      if (!popRef.current?.contains(e.target)) setPopover("");
    };
    const key = (e) => {
      if (e.key === "Escape") {
        setPopover("");
        setSidebar(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
      clearTimeout(timer.current);
    };
  }, []);
  const notify = (text) => {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4500);
  };
  const run = async (path, body, success, method = "POST", close = true) => {
    setBusy(true);
    setError("");
    try {
      const result = await api(path, body, method);
      await load(true);
      if (close) setModal(null);
      if (success) notify(success);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const go = (p) => {
    load(true);
    setPage(p);
    setQuery("");
    setFilter("Barchasi");
    setSidebar(false);
    setPopover("");
    setError("");
  };
  if (loading)
    return (
      <div className="loading-screen">
        <span className="logo">r•</span>
        <p>Rasta yuklanmoqda…</p>
      </div>
    );
  if (!data)
    return (
      <Login
        role={role}
        error={error}
        busy={busy}
        onSubmit={async (b) => {
          const r = await run("/login", b, "Xush kelibsiz", "POST", false);
          if (r) go("Umumiy");
        }}
      />
    );
  if (data.user.mustChangePassword) return (
    <div className="login-page"><Panel className="login-card">
      <h1>Shaxsiy parol yarating</h1>
      <p>Demo parol bilan biznes amallari yopilgan. Davom etish uchun kamida 12 belgili yangi parol kiriting.</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <Account session={data.session} user={data.user} busy={busy} run={run} />
    </Panel></div>
  );
  const { user, products, orders, suppliers, stores, movements, imports } =
    data;
  const organization = suppliers.find((s) => s.id === user.supplierId),
    title = organization?.name || "Rasta boshqaruvi";
  const active = orders.filter((o) => !terminal(o)),
    low = products.filter((p) => p.stock < 20),
    net = data.metrics.net,
    delivered = data.metrics.delivered;
  const unread = data.notifications.filter(n => !n.read);
  const showNotifications = async () => {
    if (popover === "notifications") { setPopover(""); return; }
    setPopover("notifications");
    if (!unread.length) return;
    try {
      const result = await api("/notifications/read", { ids: unread.map(n => n.id) });
      setData(current => current ? { ...current, notifications: result.notifications } : current);
    } catch (e) { setError(e.message); }
  };
  const nav =
    role === "admin"
      ? [
          ["Umumiy", LayoutDashboard],
          ["Buyurtmalar", ShoppingBag],
          ["Yetkazish", Truck],
          ["Optomchilar", Users],
          ["Do‘konlar", Store],
          ["Moliya", Wallet],
        ]
      : [
          ["Umumiy", LayoutDashboard],
          ["Buyurtmalar", ShoppingBag],
          ["Mahsulotlar", Package],
          ["Ombor", Boxes],
          ["Do‘konlar", Store],
          ["Integratsiya", Upload],
          ["Moliya", Wallet],
        ];
  const filteredProducts = products.filter(
    (p) =>
      (p.name + " " + p.sku).toLowerCase().includes(query.toLowerCase()) &&
      (filter !== "Kam qolgan" || p.stock < 20),
  );
  const filteredOrders = orders.filter(
    (o) =>
      (page !== "Yetkazish" || o.delivery === "platform") &&
      (filter === "Barchasi" || o.status === filter) &&
      (o.customer + " " + o.id + " " + o.city)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const detail =
    modal?.type === "detail" ? orders.find((o) => o.id === modal.id) : null;
  const exportOrders = () =>
    downloadCSV("rasta-buyurtmalar.csv", [
      [
        "ID",
        "Do‘kon",
        "Telefon",
        "Manzil",
        "Optomchi",
        "Yetkazish",
        "Holat",
        "Summa",
      ],
      ...filteredOrders.map((o) => [
        o.id,
        o.customer,
        o.phone,
        o.address,
        suppliers.find((s) => s.id === o.supplierId)?.name,
        deliveryName(o.delivery),
        o.status,
        o.total,
      ]),
    ]);
  const openModal = (m) => {
    setError("");
    setPopover("");
    setModal(m);
  };
  const orderTable = (recent = false) => (
    <Panel className="table-panel">
      <div className="section-head">
        <div>
          <h2>{recent ? "So‘nggi buyurtmalar" : "Buyurtmalar ro‘yxati"}</h2>
          <p>Har bir yetkazma, barcha tafsilotlari bilan.</p>
        </div>
        <button
          className="secondary"
          onClick={recent ? () => go("Buyurtmalar") : exportOrders}
        >
          {recent ? "Barchasi" : "CSV eksport"}
          {recent ? <ArrowRight size={16} /> : <Download size={16} />}
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>BUYURTMA</th>
              <th>DO‘KON</th>
              <th>YETKAZISH</th>
              <th>SUMMA</th>
              <th>HOLAT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(recent ? filteredOrders.slice(0, 5) : filteredOrders).map((o) => (
              <tr
                key={o.id}
                tabIndex={0}
                onClick={() => openModal({ type: "detail", id: o.id })}
                onKeyDown={(e) =>
                  e.key === "Enter" && openModal({ type: "detail", id: o.id })
                }
              >
                <td>
                  <b>#{o.id}</b>
                  <small>
                    {o.lines.length} tur ·{" "}
                    {o.lines.reduce((n, l) => n + l.quantity, 0)} dona
                  </small>
                </td>
                <td>
                  <b>{o.customer}</b>
                  <small>{o.city}</small>
                </td>
                <td>
                  <span className="delivery-tag">
                    {deliveryName(o.delivery)}
                  </span>
                  <small>
                    {suppliers.find((s) => s.id === o.supplierId)?.name}
                  </small>
                </td>
                <td>
                  <b>{money(o.total)}</b>
                </td>
                <td>
                  <Status value={o.status} />
                </td>
                <td>
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredOrders.length && <Empty>Buyurtma topilmadi.</Empty>}
      </div>
      <div className="table-foot">
        <span>{filteredOrders.length} ta buyurtma</span>
        <span>
          <i className="live-dot" /> {connected ? "Server bilan sinxron" : "Aloqa uzilgan"}
        </span>
      </div>
    </Panel>
  );
  return (
    <div className={"app " + (role === "admin" ? "admin-app" : "")}>
      <div className="ambient a1" />
      <div className="ambient a2" />
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Menyuni yopish"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={"sidebar " + (sidebar ? "show" : "")}><div className="sidebar-scroll">
        <a className="brand" href={role === "admin" ? adminUrl : supplierUrl}>
          <span className="logo">
            r<span>•</span>
          </span>
          rasta<span className="brand-dot">.</span>
        </a>
        <p className="workspace-label">
          {role === "admin" ? "PLATFORMA BOSHQARUVI" : "OPTOMCHI ISH MAYDONI"}
        </p>
        <button
          className="workspace"
          onClick={() => openModal({ type: "account" })}
        >
          <span className="workspace-avatar">{title[0]}</span>
          <span>
            <b>{title}</b>
            <small>{roleNames[role]}</small>
          </span>
          <Settings size={15} />
        </button>
        <p className="workspace-label nav-label">BOSHQARUV</p>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => go(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Buyurtmalar" && <em>{active.length}</em>}
            </button>
          ))}
        </nav>
        </div>
        <div className="sidebar-bottom">
          <button className="user" onClick={() => { setSidebar(false); openModal({ type: "account" }); }} aria-label="Akkaunt va xavfsizlik">
            <span className="user-avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <span className="user-info"><b>{user.name}</b><small>{roleNames[role]}</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Menyu"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={20} />
            </button>
            <span>Ish maydoni</span>
            <ChevronRight size={13} />
            <b>{page}</b>
          </div>
          <div className="topbar-right" ref={popRef}>
            <span className="live">
              <i className={connected ? "" : "offline-dot"} /> {connected ? "Serverga ulangan" : "Aloqa uzilgan"}
            </span>
            <div className="notification-wrap">
              <button
                aria-label="Bildirishnomalar"
                aria-expanded={popover === "notifications"}
                className="icon-button notification"
                onClick={showNotifications}
              >
                <Bell size={19} />
                {unread.length > 0 && <i aria-label="O‘qilmagan bildirishnomalar" />}
              </button>
              {popover === "notifications" && (
                <Panel className="notifications">
                  <h3>Bildirishnomalar</h3>
                  {!data.notifications.length && <p>Hozircha bildirishnomalar yo‘q.</p>}
                  <div className="notification-list">{data.notifications.map(n => (
                    <button className="notification-item" key={n.id} onClick={() => {
                      go(n.page);
                      if (n.orderId) openModal({ type: "detail", id: n.orderId });
                      else setFilter("Kam qolgan");
                    }}><b>{n.title}</b><span>{n.message}</span>{n.at && <small>{date(n.at)}</small>}</button>
                  ))}</div>
                </Panel>
              )}
            </div>
            <div className="notification-wrap">
              <button
                className="user-avatar small-avatar"
                aria-label="Profil"
                aria-expanded={popover === "profile"}
                onClick={() =>
                  setPopover(popover === "profile" ? "" : "profile")
                }
              >
                {user.name.slice(0, 2).toUpperCase()}
              </button>
              {popover === "profile" && (
                <Panel className="notifications profile-popover">
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <span className="pill">{roleNames[role]}</span>
                  <hr />
                  <button
                    className="text-button"
                    onClick={() => openModal({ type: "account" })}
                  >
                    <Settings size={15} /> Akkaunt va xavfsizlik
                  </button>
                  <button
                    className="text-button"
                    onClick={() => run("/logout", {}, "Hisobdan chiqdingiz")}
                  >
                    <LogOut size={15} /> Chiqish
                  </button>
                </Panel>
              )}
            </div>
          </div>
        </div>
        <header>
          <div>
            <div className="eyebrow">
              RASTA BUSINESS <span>•</span>{" "}
              {role === "admin"
                ? "HAMKORLAR. SAVDO. YETKAZISH."
                : "BIZNESINGIZ BIR QARASHDA"}
            </div>
            <h1>
              {page === "Umumiy" ? (
                <>
                  Savdongiz, <span>bir maromda.</span>
                </>
              ) : (
                page
              )}
            </h1>
            <p>
              {
                {
                  Umumiy: `Xush kelibsiz, ${user.name}. Savdo uchun yangi imkoniyatlar.`,
                  Mahsulotlar:
                    "Do‘konchilar ko‘radigan katalog, ulgurji narx va minimal buyurtma.",
                  Ombor:
                    "Haqiqiy qoldiq, kirim-chiqim tarixi va zaxira nazorati.",
                  Buyurtmalar:
                    "Do‘kondan kelgan buyurtmani qabul qiling va tayyorlang.",
                  Yetkazish:
                    "Rasta yetkazmalarini kuryerga tayinlang va boshqaring.",
                  Integratsiya:
                    "Excel’dan CSV import qiling yoki ombor tizimini API orqali ulang.",
                  Optomchilar:
                    "Platformadagi optomchilar va ularning faoliyati.",
                  "Do‘konlar":
                    "Buyurtma bergan hamkor do‘konlar va aloqa ma’lumotlari.",
                  Moliya: "Savdo, qaytarish va platforma komissiyasi.",
                }[page]
              }
            </p>
          </div>
          {role === "admin" && page === "Optomchilar" && (
            <button
              className="primary"
              onClick={() => openModal({ type: "newSupplier" })}
            >
              <Plus size={18} /> Optomchi qo‘shish
            </button>
          )}
          {role === "supplier" && (
            <button
              className="primary"
              onClick={() =>
                openModal({
                  type:
                    page === "Mahsulotlar"
                      ? "product"
                      : page === "Integratsiya"
                        ? "import"
                        : "order",
                })
              }
            >
              <Plus size={18} />
              {page === "Mahsulotlar"
                ? "Mahsulot qo‘shish"
                : page === "Integratsiya"
                  ? "CSV import"
                  : "Yangi buyurtma"}
            </button>
          )}
        </header>
        {error && !modal && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="Xabarni yopish" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {organization && !organization.active && (
          <div className="error-banner">
            Optomchi faoliyati admin tomonidan to‘xtatilgan.
          </div>
        )}
        {page === "Umumiy" && (
          <>
            <div className="overview-label">
              <span>
                <i className="live-dot" /> JONLI KO‘RSATKICHLAR
              </span>
              <span>15 soniyada yangilanadi</span>
            </div>
            <section className="metrics">
              <Metric
                label="Jami savdo"
                value={money(net)}
                icon={Wallet}
                note="Qaytarilganlar chiqarilgan"
              />
              <Metric
                label="Faol buyurtmalar"
                value={String(active.length).padStart(2, "0")}
                icon={ShoppingBag}
                note="Bajarilishi kutilmoqda"
              />
              <Metric
                label={
                  role === "admin"
                    ? "Faol optomchilar"
                    : "Katalogdagi mahsulotlar"
                }
                value={
                  role === "admin"
                    ? suppliers.filter((s) => s.active).length
                    : products.length
                }
                icon={Package}
                note={
                  role === "admin"
                    ? `${stores.length} ta hamkor do‘kon`
                    : `${low.length} ta mahsulot kam qolgan`
                }
              />
              <Metric
                label="Yetkazilgan savdo"
                value={money(delivered)}
                icon={Truck}
                note="Muvaffaqiyatli yakunlangan"
              />
            </section>
            <div className="dashboard-grid">
              <Panel className="sales-panel">
                <div className="section-head">
                  <div>
                    <h2>Haftalik savdo</h2>
                    <p>Oxirgi 7 kun · haqiqiy buyurtmalar</p>
                  </div>
                  <span className="pill">UZS</span>
                </div>
                <div className="chart-total">{money(orders.filter(o => o.status !== "Qaytarildi" && o.date.slice(0,10) >= new Date(Date.now()-6*86400000).toISOString().slice(0,10)).reduce((sum,o)=>sum+o.total,0))}</div>
                <RealChart orders={orders} />
              </Panel>
              <div className="right-column">
                <Panel className="quick-panel">
                  <h2>Tezkor amallar</h2>
                  {(role === "admin"
                    ? [
                        [
                          Truck,
                          "Rasta yetkazmalari",
                          "Kuryer va buyurtma nazorati",
                          () => go("Yetkazish"),
                        ],
                        [
                          Users,
                          "Hamkorlar",
                          "Optomchilar faoliyatini boshqaring",
                          () => go("Optomchilar"),
                        ],
                      ]
                    : [
                        [
                          Package,
                          "Mahsulot qo‘shish",
                          "Katalogingizni kengaytiring",
                          () => openModal({ type: "product" }),
                        ],
                        [
                          Upload,
                          "Ombordan import",
                          "CSV yoki avtomatik API",
                          () => go("Integratsiya"),
                        ],
                      ]
                  ).map(([Icon, t, s, fn]) => (
                    <button className="quick-row" key={t} onClick={fn}>
                      <span className="tile green">
                        <Icon size={20} />
                      </span>
                      <span>
                        <b>{t}</b>
                        <small>{s}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </Panel>
                <div className="stock-alert">
                  <span className="alert-symbol">!</span>
                  <div>
                    <b>{low.length} ta mahsulot kam qolgan</b>
                    <p>Zaxirani oldindan rejalashtiring.</p>
                    <button
                      onClick={() =>
                        go(role === "admin" ? "Optomchilar" : "Ombor")
                      }
                    >
                      Batafsil <ArrowRight size={14} />
                    </button>
                  </div>
                  <Boxes className="alert-bg" size={72} />
                </div>
              </div>
            </div>
            {orderTable(true)}
          </>
        )}
        {["Buyurtmalar", "Yetkazish"].includes(page) && (
          <>
            <div className="list-toolbar">
              <div className="tabs">
                {["Barchasi", ...STATUS, "Qaytarildi"].map((x) => (
                  <button
                    key={x}
                    className={filter === x ? "selected" : ""}
                    onClick={() => setFilter(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <SearchBox value={query} onChange={setQuery} />
            </div>
            {orderTable()}
          </>
        )}
        {["Mahsulotlar", "Ombor"].includes(page) && (
          <>
            <div className="list-toolbar">
              <div className="tabs">
                {["Barchasi", "Kam qolgan"].map((x) => (
                  <button
                    key={x}
                    className={filter === x ? "selected" : ""}
                    onClick={() => setFilter(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <SearchBox value={query} onChange={setQuery} />
            </div>
            <Panel className="table-panel">
              <div className="section-head">
                <div>
                  <h2>
                    {page === "Ombor"
                      ? "Ombor qoldiqlari"
                      : "Mahsulotlar katalogi"}
                  </h2>
                  <p>{filteredProducts.length} ta mahsulot</p>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    downloadCSV("rasta-mahsulotlar.csv", [
                      [
                        "sku",
                        "name",
                        "price",
                        "stock",
                        "minOrder",
                        "category",
                        "size",
                      ],
                      ...products.map((p) => [
                        p.sku,
                        p.name,
                        p.price,
                        p.stock,
                        p.minOrder,
                        p.category,
                        p.size,
                      ]),
                    ])
                  }
                >
                  <Download size={15} /> CSV eksport
                </button>
              </div>
              {page === "Ombor" ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>MAHSULOT / SKU</th>
                        <th>QOLDIQ</th>
                        <th>HOLAT</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <b>{p.name}</b>
                            <small>{p.sku}</small>
                          </td>
                          <td>
                            <b>{p.stock} dona</b>
                          </td>
                          <td>
                            <Status
                              value={p.stock < 20 ? "Kam qolgan" : "Mavjud"}
                            />
                          </td>
                          <td>
                            <button
                              className="secondary"
                              onClick={() =>
                                openModal({ type: "stock", product: p })
                              }
                            >
                              <Plus size={15} /> Kirim / chiqim
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="product-grid">
                  {filteredProducts.map((p) => (
                    <div className="product-card" key={p.id}>
                      <div className={"product-art " + p.color}>
                        <span>{p.emoji}</span>
                        <span className="status s3">
                          {p.active ? "Katalogda" : "Yashirilgan"}
                        </span>
                      </div>
                      <small>
                        {p.category} · {p.sku}
                      </small>
                      <h3>{p.name}</h3>
                      <p>{p.size}</p>
                      <div className="product-bottom">
                        <b>{money(p.price)}</b>
                        <span>Min. {p.minOrder} dona</span>
                      </div>
                      <button
                        className="secondary"
                        onClick={() =>
                          openModal({ type: "product", product: p })
                        }
                      >
                        Mahsulotni tahrirlash <ArrowUpRight size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!filteredProducts.length && <Empty>Mahsulot topilmadi.</Empty>}
            </Panel>
            {page === "Ombor" && (
              <Panel className="table-panel spaced">
                <div className="section-head">
                  <div>
                    <h2>Kirim-chiqim tarixi</h2>
                    <p>Buyurtma, qaytarish va import avtomatik yoziladi.</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => go("Integratsiya")}
                  >
                    Import <Upload size={15} />
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>MAHSULOT</th>
                        <th>O‘ZGARISH</th>
                        <th>QOLDIQ</th>
                        <th>SABAB</th>
                        <th>SANA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id}>
                          <td>{m.name}</td>
                          <td>
                            <b>
                              {m.delta > 0 ? "+" : ""}
                              {m.delta}
                            </b>
                          </td>
                          <td>{m.balance}</td>
                          <td>{m.reason}</td>
                          <td>{date(m.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!movements.length && (
                    <Empty>Hali kirim-chiqim qayd etilmagan.</Empty>
                  )}
                </div>
              </Panel>
            )}
          </>
        )}
        {page === "Integratsiya" && (
          <>
            <div className="integration-grid">
              <Panel className="info-panel">
                <span className="tile green">
                  <Upload size={22} />
                </span>
                <h2>Excel → CSV → Rasta</h2>
                <p>
                  Excel faylini CSV UTF-8 sifatida saqlang. Importdan oldin
                  qatorlarni tekshiramiz. Bir xil SKU mavjud mahsulotni
                  yangilaydi.
                </p>
                <button
                  className="primary"
                  onClick={() => openModal({ type: "import" })}
                >
                  CSV faylni import qilish
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    downloadCSV("rasta-import-namuna.csv", [
                      [
                        "sku",
                        "name",
                        "price",
                        "stock",
                        "minOrder",
                        "category",
                        "size",
                      ],
                      [
                        "JUICE1",
                        "Olma sharbati",
                        12000,
                        120,
                        6,
                        "Ichimliklar",
                        "1 litr",
                      ],
                    ])
                  }
                >
                  <Download size={15} /> Namuna yuklash
                </button>
              </Panel>
              <Panel className="info-panel">
                <span className="tile purple">
                  <Boxes size={22} />
                </span>
                <h2>Avtomatik sinxronlash</h2>
                <p>
                  Ombor dasturi mahsulotlarni Rasta API’ga yuborishi mumkin.
                  Umumiy adapter CSV eksport faylidagi o‘zgarishni kuzatadi.
                </p>
                <code>POST /api/integrations/sync</code>
                <p>
                  {data.integration[0]?.lastSync
                    ? "Oxirgi sinxronlash: " +
                      date(data.integration[0].lastSync)
                    : "Hali tashqi tizimdan sinxronlanmagan."}
                </p>
                <button
                  className="secondary"
                  onClick={() => openModal({ type: "apikey" })}
                >
                  {data.integration.length
                    ? "API kalitni yangilash"
                    : "API kalit yaratish"}
                </button>
              </Panel>
            </div>
            <Panel className="table-panel spaced">
              <div className="section-head">
                <h2>Import tarixi</h2>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>MANBA</th>
                      <th>MAHSULOT</th>
                      <th>SANA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.map((i) => (
                      <tr key={i.id}>
                        <td>{i.source}</td>
                        <td>{i.count} ta</td>
                        <td>{date(i.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!imports.length && <Empty>Importlar hali yo‘q.</Empty>}
              </div>
            </Panel>
          </>
        )}
        {page === "Do‘konlar" && (
          <>
            <div className="list-toolbar">
              <span>{stores.length} ta hamkor do‘kon</span>
              <SearchBox value={query} onChange={setQuery} />
            </div>
            <div className="partner-grid">
              {stores
                .filter((s) =>
                  (s.name + " " + s.city)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((s) => (
                  <Panel className="info-panel" key={s.id}>
                    <span className="tile green">
                      <Store size={22} />
                    </span>
                    <h2>{s.name}</h2>
                    <p>{s.contact}</p>
                    <a href={"tel:" + s.phone}>{s.phone}</a>
                    <p>
                      {s.city} · {s.address}
                    </p>
                    <span className="pill">
                      {orders.filter((o) => o.storeId === s.id).length} ta
                      buyurtma
                    </span>
                  </Panel>
                ))}
            </div>
          </>
        )}
        {page === "Optomchilar" && (
          <div className="partner-grid">
            {suppliers.map((s) => (
              <Panel className="info-panel" key={s.id}>
                <div className="section-head">
                  <span className="tile green">
                    <Boxes size={22} />
                  </span>
                  <Status value={s.active ? "Faol" : "To‘xtatilgan"} />
                </div>
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <p>
                  {s.city} · {s.phone}
                </p>
                <div className="partner-stats">
                  <b>
                    {products.filter((p) => p.supplierId === s.id).length}
                    <small>mahsulot</small>
                  </b>
                  <b>
                    {orders.filter((o) => o.supplierId === s.id).length}
                    <small>buyurtma</small>
                  </b>
                </div>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => openModal({ type: "supplier", supplier: s })}
                >
                  {s.active ? "Faoliyatni to‘xtatish" : "Faollashtirish"}
                </button>
              </Panel>
            ))}
          </div>
        )}
        {page === "Moliya" && (
          <>
            <section className="metrics">
              <Metric
                label="Sof savdo hajmi"
                value={money(net)}
                icon={Wallet}
                note="Qaytarishlar ayirilgan"
              />
              <Metric
                label="Yetkazilgan"
                value={money(delivered)}
                icon={Check}
                note="Yakunlangan buyurtmalar"
              />
              <Metric
                label="Qaytarishlar"
                value={money(
                  orders
                    .filter((o) => o.status === "Qaytarildi")
                    .reduce((n, o) => n + o.total, 0),
                )}
                icon={ShoppingBag}
                note="Qaytarish hisobi"
              />
              <Metric
                label="Platforma komissiyasi"
                value={data.metrics.commission == null ? "Belgilanmagan" : money(data.metrics.commission)}
                icon={Wallet}
                note={data.settings.commissionRate == null ? "Admin tarifni belgilaydi" : `Yetkazilgan savdoning ${data.settings.commissionRate}%`}
              />
            </section>
            {role === "admin" && <Panel className="commission-settings"><form onSubmit={e => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("rate");
              run("/settings", { commissionRate: value === "" ? null : Number(value) }, "Komissiya saqlandi", "PATCH", false);
            }}><Field key={data.settings.commissionRate} label="Platforma komissiyasi (%)" name="rate" type="number" min="0" max="100" step="0.01" defaultValue={data.settings.commissionRate ?? ""} placeholder="Belgilanmagan" /><Submit busy={busy} /></form></Panel>}
            {orderTable()}
            <p className="finance-note">
              Hisob-kitob hisoboti. Bank to‘lovi va pulni kartaga qaytarish
              integratsiyasi ulanmagan.
            </p>
          </>
        )}
        <footer>
          <span>
            rasta<span className="green-text">.</span>
            <span className="footer-sub"> Savdo uchun yaratilgan.</span>
          </span>
          <span>{roleNames[role]} · Rasta MVP</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {modal && (
        <Modal
          wide={["order", "detail", "import"].includes(modal.type)}
          title={
            {
              order: "Yangi buyurtma",
              product: modal.product
                ? "Mahsulotni tahrirlash"
                : "Yangi mahsulot",
              stock: "Ombor kirim / chiqimi",
              detail: `Buyurtma #${modal.id}`,
              account: "Akkaunt va xavfsizlik",
              import: "Mahsulotlarni import qilish",
              apikey: "API orqali ulanish",
              supplier: "Optomchi faoliyati",
              newSupplier: "Yangi optomchi",
            }[modal.type]
          }
          onClose={() => {
            setModal(null);
            setError("");
          }}
        >
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {modal.type === "order" && (
            <OrderForm
              products={products}
              stores={stores}
              busy={busy}
              onSubmit={(b) => run("/orders", b, "Buyurtma yaratildi")}
            />
          )}
          {modal.type === "product" && (
            <ProductForm
              categories={data.categories}
              product={modal.product}
              busy={busy}
              onSubmit={(b) =>
                run(
                  "/products" + (modal.product ? "/" + modal.product.id : ""),
                  b,
                  "Mahsulot saqlandi",
                  modal.product ? "PATCH" : "POST",
                )
              }
            />
          )}
          {modal.type === "stock" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                run(
                  "/stock",
                  {
                    ...f,
                    productId: modal.product.id,
                    quantity: Number(f.quantity),
                  },
                  "Ombor yangilandi",
                );
              }}
            >
              <p>
                {modal.product.name} · {modal.product.stock} dona
              </p>
              <Field
                label="Miqdor (+ kirim, − chiqim)"
                name="quantity"
                type="number"
                step="1"
                required
              />
              <Field
                label="Sabab"
                name="reason"
                placeholder="Masalan, yetkazib beruvchidan kirim"
                minLength={3}
                required
              />
              <Submit busy={busy} />
            </form>
          )}
          {detail && (
            <OrderDetail
              order={detail}
              role={role}
              supplier={suppliers.find((s) => s.id === detail.supplierId)}
              busy={busy}
              run={run}
            />
          )}
          {modal.type === "account" && (
            <Account session={data.session} user={user} busy={busy} run={run} />
          )}
          {modal.type === "import" && (
            <ImportForm
              busy={busy}
              onSubmit={(products) =>
                run("/import", { products }, "Import yakunlandi")
              }
            />
          )}
          {modal.type === "apikey" && (
            <ApiKey
              busy={busy}
              run={run}
              existing={data.integration.length > 0}
            />
          )}
          {modal.type === "newSupplier" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  "/suppliers",
                  Object.fromEntries(new FormData(e.currentTarget)),
                  "Optomchi qo‘shildi",
                );
              }}
            >
              <Field label="Biznes nomi" name="name" required />
              <Field label="Shahar" name="city" required />
              <Field label="Telefon" name="phone" type="tel" required />
              <Field label="Tavsif" name="description" />
              <Field label="Login email" name="email" type="email" required />
              <Field
                label="Boshlang‘ich parol (12+ belgi)"
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
              <p className="form-note">
                Kirish ma’lumotlarini optomchiga xavfsiz yetkazing. U akkauntida
                parolni almashtirishi mumkin.
              </p>
              <Submit busy={busy} label="Optomchini qo‘shish" />
            </form>
          )}
          {modal.type === "supplier" && (
            <div className="detail">
              <p>
                <b>{modal.supplier.name}</b>{" "}
                {modal.supplier.active
                  ? "to‘xtatilganda uning mahsulotlari do‘konchilarga ko‘rinmaydi va yangi buyurtma qabul qilinmaydi. Mavjud buyurtmalarni admin yakunlay oladi."
                  : "faollashtirilganda mahsulotlar katalogga qaytadi."}
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    "/suppliers/toggle",
                    { id: modal.supplier.id },
                    "Faoliyat yangilandi",
                  )
                }
              >
                Tasdiqlash
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function Login({ role, onSubmit, error, busy }) {
  return (
    <div className="login-page">
      <div className="ambient a1" />
      <div className="ambient a2" />
      <Panel className="login-card">
        <a className="brand" href={role === "admin" ? adminUrl : supplierUrl}>
          <span className="logo">
            r<span>•</span>
          </span>
          rasta.
        </a>
        <span className="eyebrow">{roleNames[role]} ISH MAYDONI</span>
        <h1>Savdoga xush kelibsiz.</h1>
        <p>Hamkorlaringiz, mahsulotlaringiz va buyurtmalaringiz bir joyda.</p>
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
          }}
        >
          <Field
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            required
          />
          <Field
            label="Parol"
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
          <button className="primary" disabled={busy}>
            {busy ? "Kirilmoqda…" : "Kirish"}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="app-links">
          <a href={supplierUrl}>Optomchi</a>
          <a href={adminUrl}>Admin</a>
          {mobileUrl && <a href={mobileUrl}>Mobil ilova</a>}
        </div>
      </Panel>
    </div>
  );
}
function Metric({ label, value, icon: Icon, note }) {
  return (
    <Panel className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className="tile green">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>
        <i className="metric-dot green" />
        {note}
      </p>
    </Panel>
  );
}
function Status({ value }) {
  return (
    <span
      className={
        "status s" +
        (value === "Qaytarildi"
          ? 4
          : value === "Kam qolgan"
            ? 2
            : Math.max(0, STATUS.indexOf(value)))
      }
    >
      <i />
      {value}
    </span>
  );
}
function Submit({ busy, label = "Saqlash" }) {
  return (
    <div className="form-actions">
      <button className="primary" type="submit" disabled={busy}>
        <Check size={16} />
        {busy ? "Saqlanmoqda…" : label}
      </button>
    </div>
  );
}
function ProductForm({ product: p, categories, busy, onSubmit }) {
  const [category, setCategory] = useState(p?.category || categories[0]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        onSubmit({
          ...f,
          category,
          price: Number(f.price),
          stock: p?.stock || Number(f.stock),
          minOrder: Number(f.minOrder),
          active: f.active === "on",
        });
      }}
    >
      <div className="form-grid">
        <Field
          label="Mahsulot nomi"
          name="name"
          required
          maxLength={100}
          defaultValue={p?.name}
        />
        <Field
          label="SKU"
          name="sku"
          required
          maxLength={60}
          defaultValue={p?.sku}
        />
      </div>
      <Field
        label="Qadoq tavsifi"
        name="size"
        defaultValue={p?.size}
        placeholder="1 litr · 6 dona / quti"
      />
      <Select
        label="Kategoriya"
        options={categories}
        value={category}
        onChange={setCategory}
      />
      <div className="form-grid">
        <Field
          label="Ulgurji narx (so‘m)"
          name="price"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={p?.price}
        />
        <Field
          label="Minimal buyurtma (dona)"
          name="minOrder"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={p?.minOrder || 1}
        />
      </div>
      {!p && (
        <Field
          label="Boshlang‘ich qoldiq"
          name="stock"
          type="number"
          min="0"
          step="1"
          required
          defaultValue="0"
        />
      )}
      <label className="checkbox-field">
        <input
          type="checkbox"
          name="active"
          defaultChecked={p?.active ?? true}
        />
        Do‘konchilar katalogida ko‘rsatish
      </label>
      <Submit busy={busy} />
    </form>
  );
}
function OrderForm({ products, stores, busy, onSubmit }) {
  const [customer, setCustomer] = useState(""),
    [storeId, setStoreId] = useState(""),
    [info, setInfo] = useState({
      city: "Toshkent",
      phone: "",
      address: "",
      contact: "",
      notes: "",
    }),
    [product, setProduct] = useState(""),
    [qty, setQty] = useState(1),
    [lines, setLines] = useState([]),
    [delivery, setDelivery] = useState("supplier"),
    [localError, setLocalError] = useState("");
  const choose = (value, create) => {
    const s = stores.find((x) => x.id === value);
    setCustomer(s?.name || value);
    setStoreId(s?.id || "");
    if (s)
      setInfo({
        city: s.city,
        phone: s.phone,
        address: s.address,
        contact: s.contact,
        notes: "",
      });
    else
      setInfo({
        city: "Toshkent",
        phone: "",
        address: "",
        contact: "",
        notes: "",
      });
  };
  const add = () => {
    const p = products.find((p) => p.id === product);
    if (!p) {
      setLocalError("Mahsulot tanlang.");
      return;
    }
    const existing = lines.find((l) => l.productId === product)?.quantity || 0;
    if (
      !Number.isInteger(Number(qty)) ||
      Number(qty) < 1 ||
      Number(qty) + existing > p.stock ||
      Number(qty) + existing < p.minOrder
    ) {
      setLocalError(
        `${p.name}: minimum ${p.minOrder}, qoldiq ${p.stock} dona.`,
      );
      return;
    }
    setLines([
      ...lines.filter((l) => l.productId !== product),
      {
        productId: product,
        name: p.name,
        price: p.price,
        quantity: Number(qty) + existing,
      },
    ]);
    setLocalError("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!lines.length) {
          setLocalError("Kamida bitta mahsulotni ro‘yxatga qo‘shing.");
          return;
        }
        onSubmit({
          ...info,
          customer,
          storeId: storeId || undefined,
          lines: lines.map(({ productId, quantity }) => ({
            productId,
            quantity,
          })),
          delivery,
        });
      }}
    >
      <Select
        label="Do‘kon"
        searchable
        creatable
        options={stores.map((s) => ({ value: s.id, label: s.name }))}
        value={storeId || customer}
        onChange={choose}
        placeholder="Do‘kon qidiring yoki yangi nom yozing"
      />
      <p className="form-note">
        Yangi nom buyurtma saqlanganda do‘konlar ro‘yxatiga qo‘shiladi.
      </p>
      <div className="form-grid">
        {[
          ["contact", "Aloqa shaxsi"],
          ["phone", "Telefon raqami"],
          ["city", "Shahar"],
          ["address", "Yetkazish manzili"],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            type={key === "phone" ? "tel" : "text"}
            required
            value={info[key]}
            onChange={(e) => setInfo({ ...info, [key]: e.target.value })}
          />
        ))}
      </div>
      <div className="order-builder">
        <Select
          label="Mahsulot"
          searchable
          options={products
            .filter((p) => p.active && p.stock > 0)
            .map((p) => ({
              value: p.id,
              label: `${p.name} — ${money(p.price)} · ${p.stock} dona`,
            }))}
          value={product}
          onChange={(id) => {
            setProduct(id);
            setQty(products.find((p) => p.id === id).minOrder);
          }}
          placeholder="Mahsulotni qidiring"
        />
        <div className="quantity-row">
          <Field
            label="Miqdor"
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button className="secondary" type="button" onClick={add}>
            <Plus size={16} /> Ro‘yxatga qo‘shish
          </button>
        </div>
      </div>
      {localError && (
        <p role="alert" className="error-text">
          {localError}
        </p>
      )}
      <div className="line-list">
        {lines.map((l) => (
          <div className="line-item" key={l.productId}>
            <div>
              <b>{l.name}</b>
              <small>
                {l.quantity} × {money(l.price)}
              </small>
            </div>
            <b>{money(l.price * l.quantity)}</b>
            <button
              type="button"
              aria-label={l.name + "ni olib tashlash"}
              className="icon-button"
              onClick={() =>
                setLines(lines.filter((x) => x.productId !== l.productId))
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <Select
        label="Yetkazib berish"
        options={[
          { value: "supplier", label: "Optomchi yetkazadi" },
          { value: "platform", label: "Rasta yetkazadi" },
        ]}
        value={delivery}
        onChange={setDelivery}
      />
      <Field
        label="Yetkazishga izoh (ixtiyoriy)"
        value={info.notes}
        onChange={(e) => setInfo({ ...info, notes: e.target.value })}
      />
      <div className="order-total">
        <span>Jami</span>
        <strong>
          {money(lines.reduce((n, l) => n + l.price * l.quantity, 0))}
        </strong>
      </div>
      <Submit busy={busy} label="Buyurtmani yaratish" />
    </form>
  );
}
function OrderDetail({ order: o, role, supplier, busy, run }) {
  const [refund, setRefund] = useState(false);
  const next = STATUS[STATUS.indexOf(o.status) + 1],
    canUpdate =
      !terminal(o) &&
      (role === "admin" || o.delivery === "supplier" || o.status === "Yangi");
  return (
    <div className="order-detail">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">{supplier?.name}</span>
          <h3>{o.customer}</h3>
          <p>{date(o.date)}</p>
        </div>
        <Status value={o.status} />
      </div>
      <div className="delivery-card">
        <div>
          <small>ALOQA SHAXSI</small>
          <b>{o.contact}</b>
          <a href={"tel:" + o.phone}>{o.phone}</a>
        </div>
        <div>
          <small>YETKAZISH MANZILI</small>
          <b>{o.city}</b>
          <span>{o.address}</span>
        </div>
      </div>
      <p>
        <b>{deliveryName(o.delivery)}</b>
        {o.courier && ` · Kuryer: ${o.courier}`}
      </p>
      {o.notes && <p className="form-note">Izoh: {o.notes}</p>}
      <h4>Buyurtma tarkibi</h4>
      <div className="line-list">
        {o.lines.map((l) => (
          <div className="line-item" key={l.productId}>
            <div>
              <b>{l.name}</b>
              <small>
                {l.sku} · {l.quantity} dona × {money(l.price)}
              </small>
            </div>
            <b>{money(l.price * l.quantity)}</b>
          </div>
        ))}
      </div>
      <div className="order-total">
        <span>Jami</span>
        <strong>{money(o.total)}</strong>
      </div>
      {!terminal(o) && (
        <>
          <label className="field">Buyurtma holati</label>
          {canUpdate ? (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(
                  `/orders/${o.id}/status`,
                  { status: next },
                  "Holat yangilandi",
                  "POST",
                  false,
                )
              }
            >
              {next} deb belgilash <ArrowRight size={16} />
            </button>
          ) : (
            <p className="form-note">
              Buyurtma Rasta yetkazish xizmatini kutmoqda. Keyingi holatni admin
              yangilaydi.
            </p>
          )}
        </>
      )}
      {o.status === "Yetkazildi" && (
        <div className="return-section">
          <p>
            <Check size={16} /> Buyurtma yetkazilgan. Holatni o‘zgartirish
            yopilgan.
          </p>
          {!refund ? (
            <button
              className="secondary danger"
              onClick={() => setRefund(true)}
            >
              Qaytarish (refund)
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                run(
                  `/orders/${o.id}/refund`,
                  { reason: f.reason, restock: f.restock === "on" },
                  "Buyurtma qaytarildi",
                  "POST",
                  false,
                );
              }}
            >
              <Field
                label="Qaytarish sababi"
                name="reason"
                required
                minLength={5}
              />
              <label className="checkbox-field">
                <input type="checkbox" name="restock" />
                Qabul qilingan mahsulotlarni omborga qaytarish
              </label>
              <p className="form-note">
                To‘liq qaytarish: {money(o.total)}. Bank orqali pul qaytarish
                alohida bajariladi.
              </p>
              <Submit busy={busy} label="Qaytarishni tasdiqlash" />
            </form>
          )}
        </div>
      )}
      {o.refund && (
        <div className="return-section">
          <b>Qaytarildi: {money(o.refund.amount)}</b>
          <p>{o.refund.reason}</p>
          <p>
            {o.refund.restock
              ? "Mahsulot omborga qaytarilgan."
              : "Mahsulot omborga qo‘shilmagan."}
          </p>
        </div>
      )}
      {role === "admin" && o.delivery === "platform" && !terminal(o) && (
        <form
          className="courier-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              `/orders/${o.id}/assign`,
              Object.fromEntries(new FormData(e.currentTarget)),
              "Kuryer tayinlandi",
              "POST",
              false,
            );
          }}
        >
          <Field
            label="Kuryer (ism va telefon)"
            name="courier"
            defaultValue={o.courier}
            required
          />
          <Submit busy={busy} label="Kuryerni tayinlash" />
        </form>
      )}
      <details className="timeline">
        <summary>Buyurtma tarixi</summary>
        {o.history.map((h, i) => (
          <p key={i}>
            <b>{h.status}</b>
            <small>
              {date(h.at)} · {h.actor}
            </small>
          </p>
        ))}
      </details>
    </div>
  );
}
function ImportForm({ busy, onSubmit }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [file, setFile] = useState("");
  const read = async (e) => {
    setRows([]);
    setError("");
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2e6) {
      setError("Fayl 2 MB dan oshmasin.");
      return;
    }
    setFile(f.name);
    try {
      const parsed = parseCSV(await f.text());
      if (!parsed.length || parsed.length > 1000)
        throw new Error("1–1000 qator bo‘lishi kerak.");
      parsed.forEach((p, i) => {
        try {
          validateProduct(p);
        } catch (e) {
          throw new Error(`${i + 2}-qator: ${e.message}`);
        }
      });
      if (new Set(parsed.map((p) => p.sku)).size !== parsed.length)
        throw new Error("Takrorlangan SKU mavjud.");
      setRows(parsed);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div>
      <p>
        Excel’da “CSV UTF-8” formatida saqlang. Qoldiq fayldagi qiymatga
        tenglashtiriladi; faol buyurtmalarni hisobga olgan mavjud qoldiqni
        kiriting.
      </p>
      <label className="upload-zone">
        <Upload size={26} />
        <b>CSV fayl tanlang</b>
        <span>2 MB gacha · 1000 mahsulotgacha</span>
        <input
          aria-label="CSV fayl"
          type="file"
          accept=".csv,text/csv"
          onChange={read}
        />
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p>
            <b>{file}</b> · {rows.length} ta mahsulot tayyor
          </p>
          <div className="table-scroll import-preview">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>MAHSULOT</th>
                  <th>NARX</th>
                  <th>QOLDIQ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.sku}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td>{money(p.price)}</td>
                    <td>{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="form-note">
            Mavjud SKU yangilanadi. Faylda yo‘q mahsulotlar saqlanib qoladi.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => onSubmit(rows)}
          >
            {busy ? "Import qilinmoqda…" : "Importni tasdiqlash"}
          </button>
        </>
      )}
    </div>
  );
}
function Account({ user, session, busy, run }) {
  return (
    <div>
      <div className="account-info">
        <span className="user-avatar">
          {user.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h3>{user.name}</h3>
          <p>
            {user.email} · {roleNames[user.role]}
          </p>
        </div>
      </div>
      {!user.mustChangePassword && <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            "/profile",
            Object.fromEntries(new FormData(e.currentTarget)),
            "Profil saqlandi",
            "PATCH",
            false,
          );
        }}
      >
        <Field
          label="Ism"
          name="name"
          required
          minLength={2}
          defaultValue={user.name}
        />
        <Submit busy={busy} />
      </form>
      </>}
      <hr />
      <h3>Xavfsizlik</h3>
      <p className="form-note">
        Sessiya tugashi: {date(session.expiresAt)}. Parol yangilanganda boshqa sessiyalar
        yopiladi.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const r = await run(
            "/password",
            Object.fromEntries(new FormData(form)),
            "Parol yangilandi",
            "POST",
            false,
          );
          if (r) form.reset();
        }}
      >
        <Field
          label="Joriy parol"
          type="password"
          name="current"
          autoComplete="current-password"
          required
        />
        <Field
          label="Yangi parol"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
        <Submit busy={busy} label="Parolni yangilash" />
      </form>
      <button
        className="text-button danger"
        onClick={() => run("/logout", {}, "Hisobdan chiqdingiz")}
      >
        <LogOut size={16} /> Akkauntdan chiqish
      </button>
    </div>
  );
}
function ApiKey({ busy, run, existing }) {
  const [key, setKey] = useState("");
  return (
    <div>
      <p>
        {existing
          ? "Yangi kalit yaratilsa eski kalit darhol bekor qilinadi."
          : "Kalit faqat sizning mahsulotlaringizni sinxronlaydi."}{" "}
        Kalitni ombor tizimiga maxfiy sozlama sifatida kiriting.
      </p>
      {key ? (
        <>
          <p className="form-note">
            Kalit faqat shu safar to‘liq ko‘rsatiladi. Nusxasini xavfsiz
            saqlang.
          </p>
          <textarea aria-label="API kalit" readOnly value={key} rows={3} />
          <code className="code-block">
            Authorization: Bearer &lt;API_KALIT&gt;
            <br />
            POST /api/integrations/sync
            <br />
            {
              '{"products":[{"sku":"JUICE1","name":"Sharbat","price":12000,"stock":100,"minOrder":6}]}'
            }
          </code>
        </>
      ) : (
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            const r = await run(
              "/integrations/key",
              {},
              "Kalit yaratildi",
              "POST",
              false,
            );
            if (r) setKey(r.key);
          }}
        >
          Kalitni yaratish{existing ? " va eskisini bekor qilish" : ""}
        </button>
      )}
    </div>
  );
}
function RealChart({ orders }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const key = d.toISOString().slice(0, 10);
    return {
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      total: orders
        .filter((o) => o.date.slice(0, 10) === key && o.status !== "Qaytarildi")
        .reduce((n, o) => n + o.total, 0),
    };
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div
      className="real-chart"
      role="img"
      aria-label={
        "Oxirgi 7 kun savdosi: " +
        days.map((d) => d.label + " " + money(d.total)).join("; ")
      }
    >
      {days.map((d) => (
        <div className="bar-column" key={d.label}>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                height: Math.max(d.total ? 4 : 0, (d.total / max) * 100) + "%",
              }}
              title={money(d.total)}
            >
              <span>{d.total ? Math.round(d.total / 1000) + "k" : ""}</span>
            </div>
          </div>
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}
