import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import * as SecureStore from "expo-secure-store";
import { useFonts } from "expo-font";
import { icons } from "./assets/icons.js";
import { money } from "../../packages/domain/index.js";
const base =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "web" ? "" : "http://127.0.0.1:4173");
const colors = {
  ink: "#203f36",
  muted: "#70887a",
  green: "#2c735c",
  line: "#d9e5dc",
};
const deliveryName = (x) =>
  x === "platform" ? "Rasta yetkazadi" : "Optomchi yetkazadi";
function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  style,
  accessibilityLabel,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.green }]}>
        {children}
      </Text>
    </Pressable>
  );
}
function Input({ label, ...props }) {
  return (
    <View style={s.inputField}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#91a295"
        style={s.input}
        {...props}
      />
    </View>
  );
}
function Card({ children, style }) {
  return (
    <View style={[s.card, style]}>
      <BlurView
        intensity={20}
        tint="light"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
function Badge({ children }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{children}</Text>
    </View>
  );
}
export default function App() {
  const [fontsLoaded, fontError] = useFonts({ RastaIcons: require("./assets/uicons-regular-rounded.ttf") });
  const [state, setState] = useState(null),
    [ready, setReady] = useState(false),
    [connected, setConnected] = useState(false),
    [token, setToken] = useState(null),
    [tab, setTab] = useState("Katalog"),
    [search, setSearch] = useState(""),
    [supplier, setSupplier] = useState(""),
    [category, setCategory] = useState("Barchasi"),
    [cart, setCart] = useState({}),
    [detail, setDetail] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [delivery, setDelivery] = useState("platform"),
    [address, setAddress] = useState({
      customer: "",
      contact: "",
      phone: "",
      city: "",
      address: "",
      notes: "",
    }),
    [auth, setAuth] = useState({
      email: "",
      password: "",
      name: "",
      storeName: "",
      phone: "",
      city: "",
      address: "",
    }),
    [register, setRegister] = useState(false);
  const tokenRef = useRef(null),
    timer = useRef(null),
    initialAddress = useRef(false);
  const request = async (path, body, method = "POST") => {
    const r = await fetch(base + "/api" + path, {
      method: body === undefined ? "GET" : method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Rasta-App": "retailer",
        ...(tokenRef.current
          ? { Authorization: "Bearer " + tokenRef.current }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = await r.json();
    if (!r.ok) {
      if (r.status === 401) setState(null);
      throw new Error(json.error || "Server javob bermadi.");
    }
    return json;
  };
  const load = async (quiet = false) => {
    try {
      const data = await request("/state");
      setState(data);
      setConnected(true);
      setCart(data.cart);
      if (!initialAddress.current && data.stores[0]) {
        const store = data.stores[0];
        setAddress({
          customer: store.name,
          contact: store.contact,
          phone: store.phone,
          city: store.city,
          address: store.address,
          notes: "",
        });
        initialAddress.current = true;
      }
      return data;
    } catch (e) {
      setConnected(false);
      if (!quiet && e.message !== "Akkauntingizga kiring.") setError(e.message);
    }
  };
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS !== "web") {
          const saved = await SecureStore.getItemAsync("rasta-session");
          tokenRef.current = saved;
          setToken(saved);
        }
        await load();
      } catch (e) {
        setError(e.message);
      } finally {
        setReady(true);
      }
    })();
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, [!!state]);
  const notify = (message) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4500);
  };
  const action = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const login = () =>
    action(async () => {
      if (register) await request("/register", { ...auth, contact: auth.name });
      const result = await request("/login", {
        email: auth.email,
        password: auth.password,
        native: Platform.OS !== "web",
      });
      tokenRef.current = result.token || null;
      setToken(result.token || null);
      if (Platform.OS !== "web" && result.token)
        await SecureStore.setItemAsync("rasta-session", result.token);
      initialAddress.current = false;
      await load();
      setAuth({ ...auth, password: "" });
    });
  const logout = () =>
    action(async () => {
      await request("/logout", {});
      if (Platform.OS !== "web")
        await SecureStore.deleteItemAsync("rasta-session");
      tokenRef.current = null;
      setToken(null);
      setState(null);
      setCart({});
      initialAddress.current = false;
      setTab("Katalog");
    });
  const changeTab = (t) => {
    load(true);
    setTab(t);
    setError("");
  };
  if (!ready || (!fontsLoaded && !fontError))
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.green} />
        <Text style={s.caption}>Rasta yuklanmoqda…</Text>
      </View>
    );
  if (!state)
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.authWrap}
            keyboardShouldPersistTaps="handled"
          >
            <Card style={s.authCard}>
              <Text style={s.brand}>
                rasta<Text style={s.brandDot}>.</Text>
              </Text>
              <Text style={s.eyebrow}>DO‘KONINGIZ UCHUN</Text>
              <Text style={s.heroTitle}>
                {register
                  ? "Rastaga qo‘shiling."
                  : "Yaxshi savdo shu yerdan boshlanadi."}
              </Text>
              <Text style={s.caption}>
                Ishonchli optomchilar. Ulgurji narxlar. Qulay yetkazish.
              </Text>
              {error ? (
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
              ) : null}
              {register && (
                <>
                  <Input
                    label="Ism va familiya"
                    value={auth.name}
                    onChangeText={(name) => setAuth({ ...auth, name })}
                  />
                  <Input
                    label="Do‘kon nomi"
                    value={auth.storeName}
                    onChangeText={(storeName) =>
                      setAuth({ ...auth, storeName })
                    }
                  />
                  <Input
                    label="Telefon"
                    keyboardType="phone-pad"
                    value={auth.phone}
                    onChangeText={(phone) => setAuth({ ...auth, phone })}
                  />
                  <Input
                    label="Shahar"
                    value={auth.city}
                    onChangeText={(city) => setAuth({ ...auth, city })}
                  />
                  <Input
                    label="Manzil"
                    value={auth.address}
                    onChangeText={(address) => setAuth({ ...auth, address })}
                  />
                </>
              )}
              <Input
                label="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={auth.email}
                onChangeText={(email) => setAuth({ ...auth, email })}
              />
              <Input
                label="Parol"
                secureTextEntry
                autoComplete={register ? "new-password" : "current-password"}
                value={auth.password}
                onChangeText={(password) => setAuth({ ...auth, password })}
              />
              <Button disabled={busy} onPress={login}>
                {busy
                  ? "Kutilmoqda…"
                  : register
                    ? "Ro‘yxatdan o‘tish"
                    : "Kirish →"}
              </Button>
              <Button
                secondary
                onPress={() => {
                  setRegister(!register);
                  setError("");
                }}
              >
                {register ? "Akkauntim bor" : "Yangi do‘kon ochish"}
              </Button>

            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  const { products, suppliers, orders, user } = state;
  const visible = products.filter(
    (p) =>
      (!supplier || p.supplierId === supplier) &&
      (category === "Barchasi" || p.category === category) &&
      (p.name + " " + p.sku).toLowerCase().includes(search.toLowerCase()),
  );
  const entries = Object.entries(cart).map(([id, quantity]) => ({
    product: products.find((p) => p.id === id),
    id,
    quantity,
  }));
  const total = entries.reduce(
      (n, { product, quantity }) => n + (product?.price || 0) * quantity,
      0,
    ),
    count = entries.reduce((n, l) => n + l.quantity, 0);
  const saveCart = (productId, quantity, message) => action(async () => {
    const result = await request("/cart", { productId, quantity }, "PATCH");
    setCart(result.cart);
    if (message) notify(message);
  });
  const add = p => saveCart(p.id, cart[p.id] ? cart[p.id] + 1 : p.minOrder, p.name + " savatga qo‘shildi");
  const updateQty = (p, delta) => {
    const quantity = cart[p.id] + delta;
    saveCart(p.id, quantity < p.minOrder ? 0 : quantity);
  };
  const checkout = () =>
    action(async () => {
      if (!entries.length) throw new Error("Savat bo‘sh.");
      const result = await request("/orders", {
        ...address,
        delivery,
        lines: entries.map((e) => ({ productId: e.id, quantity: e.quantity })),
      });
      setCart({});
      await load();
      changeTab("Buyurtmalar");
      notify(
        `${result.orders.length} ta buyurtma yuborildi. Optomchi tasdig‘ini kuting.`,
      );
    });
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.appShell}>
        <View style={s.topbar}>
          <View>
            <Text style={s.brand}>
              rasta<Text style={s.brandDot}>.</Text>
            </Text>
            <Text style={s.topSubtitle}>
              {state.stores[0]?.name} · {state.stores[0]?.city}{!connected ? " · Aloqa uzilgan" : ""}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profil"
            onPress={() => changeTab("Profil")}
            style={s.avatar}
          >
            <Text style={s.avatarText}>
              {user.name.slice(0, 2).toUpperCase()}
            </Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            ) : null}
            {tab === "Katalog" && (
              <>
                <View style={s.hero}>
                  <Text style={s.eyebrow}>HAMKORLIKDA BARAKA BOR</Text>
                  <Text style={s.heroTitle}>
                    Peshtaxtangizga{"\n"}yangi imkoniyatlar.
                  </Text>
                  <Text style={s.caption}>
                    Kerakli mahsulotlar, to‘g‘ridan-to‘g‘ri optomchidan.
                  </Text>
                  <View style={s.heroBadge}>
                    <Text style={s.heroBadgeText}>
                      {suppliers.filter((x) => x.active).length} optomchi ·{" "}
                      {products.length} mahsulot
                    </Text>
                  </View>
                </View>
                <TextInput
                  accessibilityLabel="Mahsulot qidirish"
                  style={s.search}
                  placeholder="Mahsulot yoki SKU qidiring…"
                  placeholderTextColor="#8a9d90"
                  value={search}
                  onChangeText={setSearch}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.chipScroll}
                >
                  {["Barchasi", ...state.categories].map((c) => (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      accessibilityState={{ selected: category === c }}
                      onPress={() => setCategory(c)}
                      style={[s.chip, category === c && s.chipSelected]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          category === c && s.chipTextSelected,
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {supplier && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSupplier("")}
                    style={s.supplierFilter}
                  >
                    <Text style={s.link}>
                      {suppliers.find((x) => x.id === supplier)?.name} · Filtrni
                      tozalash ×
                    </Text>
                  </Pressable>
                )}
                <View style={s.sectionTitle}>
                  <Text style={s.h2}>Siz uchun tanlov</Text>
                  <Text style={s.caption}>{visible.length} mahsulot</Text>
                </View>
                <View style={s.productGrid}>
                  {visible.map((p) => (
                    <Card style={s.productCard} key={p.id}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={p.name + " tafsilotlari"}
                        onPress={() => setDetail({ type: "product", id: p.id })}
                      >
                        <View
                          style={[
                            s.productArt,
                            {
                              backgroundColor:
                                {
                                  rose: "#efe3df",
                                  yellow: "#efecd8",
                                  brown: "#e7e3db",
                                  green: "#e2eadf",
                                  blue: "#dee7e8",
                                }[p.color] || "#e2eadf",
                            },
                          ]}
                        >
                          <Text style={s.productEmoji}>{p.emoji}</Text>
                        </View>
                        <Text style={s.productSupplier}>
                          {suppliers.find((x) => x.id === p.supplierId)?.name}
                        </Text>
                        <Text style={s.productName}>{p.name}</Text>
                        <Text style={s.productSize}>{p.size}</Text>
                        <Text style={s.price}>{money(p.price)}</Text>
                        <Text style={s.minimum}>
                          Min. {p.minOrder} dona · {p.stock} mavjud
                        </Text>
                      </Pressable>
                      <Button
                        secondary
                        disabled={p.stock < p.minOrder}
                        onPress={() => add(p)}
                      >
                        {cart[p.id] ? `Savatda ${cart[p.id]} · +` : "+ Savatga"}
                      </Button>
                    </Card>
                  ))}
                </View>
                {!visible.length && (
                  <Text style={s.empty}>
                    Mahsulot topilmadi. Qidiruv yoki filtrni o‘zgartiring.
                  </Text>
                )}
              </>
            )}
            {tab === "Optomchilar" && (
              <>
                <Text style={s.heroTitle}>Ishonchli hamkorlar.</Text>
                <Text style={s.caption}>
                  O‘zingizga qulay optomchini tanlang.
                </Text>
                {suppliers
                  .filter((x) => x.active)
                  .map((sup) => (
                    <Card key={sup.id} style={s.partnerCard}>
                      <View style={s.partnerTop}>
                        <View style={s.partnerIcon}>
                          <Text style={s.partnerLetter}>{sup.name[0]}</Text>
                        </View>
                        <Badge>{sup.city}</Badge>
                      </View>
                      <Text style={s.h2}>{sup.name}</Text>
                      <Text style={s.caption}>{sup.description}</Text>
                      <Text style={s.caption}>
                        {sup.phone} ·{" "}
                        {products.filter((p) => p.supplierId === sup.id).length}{" "}
                        mahsulot
                      </Text>
                      <Button
                        secondary
                        onPress={() => {
                          setSupplier(sup.id);
                          setCategory("Barchasi");
                          setSearch("");
                          changeTab("Katalog");
                        }}
                      >
                        Katalogni ko‘rish →
                      </Button>
                    </Card>
                  ))}
              </>
            )}
            {tab === "Savat" && (
              <>
                <View style={s.sectionTitle}>
                  <Text style={s.heroTitle}>Savatingiz.</Text>
                  <Badge>{count} dona</Badge>
                </View>
                {!entries.length ? (
                  <Card>
                    <Text style={s.empty}>
                      Savat hali bo‘sh. Katalogdan mahsulot qo‘shing.
                    </Text>
                    <Button onPress={() => changeTab("Katalog")}>
                      Katalogga o‘tish
                    </Button>
                  </Card>
                ) : (
                  <>
                    {entries.map(({ product: p, id, quantity }) => (
                      <Card key={id} style={s.cartCard}>
                        <View style={s.row}>
                          <Text style={s.cartEmoji}>{p?.emoji || "📦"}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.productName}>
                              {p?.name || "Mahsulot endi mavjud emas"}
                            </Text>
                            <Text style={s.caption}>
                              {p
                                ? suppliers.find((x) => x.id === p.supplierId)
                                    ?.name
                                : ""}
                            </Text>
                            <Text style={s.price}>
                              {money((p?.price || 0) * quantity)}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              (p?.name || id) + "ni savatdan o‘chirish"
                            }
                            disabled={busy}
                            onPress={() => saveCart(id, 0)}
                          >
                            <Text style={s.remove}>×</Text>
                          </Pressable>
                        </View>
                        {p && (
                          <View style={s.quantity}>
                            <Button
                              secondary
                              accessibilityLabel={
                                p.name + " miqdorini kamaytirish"
                              }
                              onPress={() => updateQty(p, -1)}
                            >
                              −
                            </Button>
                            <Text style={s.quantityText}>{quantity} dona</Text>
                            <Button
                              secondary
                              accessibilityLabel={
                                p.name + " miqdorini oshirish"
                              }
                              onPress={() => updateQty(p, 1)}
                            >
                              +
                            </Button>
                          </View>
                        )}
                      </Card>
                    ))}
                    <Card>
                      <Text style={s.h2}>Yetkazish ma’lumotlari</Text>
                      {[
                        ["customer", "Do‘kon nomi"],
                        ["contact", "Aloqa shaxsi"],
                        ["phone", "Telefon raqami"],
                        ["city", "Shahar"],
                        ["address", "Yetkazish manzili"],
                        ["notes", "Izoh (ixtiyoriy)"],
                      ].map(([key, label]) => (
                        <Input
                          key={key}
                          label={label}
                          value={address[key]}
                          keyboardType={
                            key === "phone" ? "phone-pad" : "default"
                          }
                          onChangeText={(value) =>
                            setAddress({ ...address, [key]: value })
                          }
                        />
                      ))}
                      <Text style={s.label}>Kim yetkazadi?</Text>
                      <View style={s.deliveryOptions}>
                        {["platform", "supplier"].map((x) => (
                          <Pressable
                            key={x}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: delivery === x }}
                            onPress={() => setDelivery(x)}
                            style={[
                              s.deliveryOption,
                              delivery === x && s.deliverySelected,
                            ]}
                          >
                            <Text style={s.deliveryText}>
                              {delivery === x ? "◉" : "○"} {deliveryName(x)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={s.note}>
                        Yetkazish muddati va narxi operator bilan kelishiladi.
                        Buyurtma har bir optomchi uchun alohida yaratiladi.
                      </Text>
                      <View style={s.totalRow}>
                        <Text style={s.h2}>Mahsulotlar jami</Text>
                        <Text style={s.total}>{money(total)}</Text>
                      </View>
                      <Button
                        disabled={busy || entries.some((e) => !e.product)}
                        onPress={checkout}
                      >
                        {busy ? "Yuborilmoqda…" : "Buyurtma berish →"}
                      </Button>
                    </Card>
                  </>
                )}
              </>
            )}
            {tab === "Buyurtmalar" && (
              <>
                <Text style={s.heroTitle}>Buyurtmalaringiz.</Text>
                <Text style={s.caption}>
                  Tayyorlanishdan yetkazishgacha kuzating.
                </Text>
                {orders.map((o) => (
                  <Pressable
                    key={o.id}
                    accessibilityRole="button"
                    accessibilityLabel={"Buyurtma " + o.id + " tafsilotlari"}
                    onPress={() => setDetail({ type: "order", id: o.id })}
                  >
                    <Card style={s.orderCard}>
                      <View style={s.sectionTitle}>
                        <Text style={s.h2}>#{o.id}</Text>
                        <Badge>{o.status}</Badge>
                      </View>
                      <Text style={s.productName}>
                        {suppliers.find((x) => x.id === o.supplierId)?.name}
                      </Text>
                      <Text style={s.caption}>
                        {o.lines.map((l) => l.name).join(", ")}
                      </Text>
                      <View style={s.sectionTitle}>
                        <Text style={s.price}>{money(o.total)}</Text>
                        <Text style={s.link}>Batafsil →</Text>
                      </View>
                      <Text style={s.note}>{deliveryName(o.delivery)}</Text>
                    </Card>
                  </Pressable>
                ))}
                {!orders.length && (
                  <Text style={s.empty}>Hali buyurtmalar yo‘q.</Text>
                )}
              </>
            )}
            {tab === "Profil" && (
              <>
                <Text style={s.heroTitle}>Mening do‘konim.</Text>
                <Card>
                  <View style={s.row}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>
                        {user.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.h2}>{user.name}</Text>
                      <Text style={s.caption}>{user.email}</Text>
                    </View>
                  </View>
                  <Text style={s.note}>
                    Sessiya tugashi: {new Date(state.session.expiresAt).toLocaleString("en-GB")}
                  </Text>
                  <Text style={s.h2}>Yetkazish manzili</Text>
                  {[
                    ["customer", "Do‘kon nomi"],
                    ["contact", "Aloqa shaxsi"],
                    ["phone", "Telefon raqami"],
                    ["city", "Shahar"],
                    ["address", "Yetkazish manzili"],
                  ].map(([key, label]) => (
                    <Input
                      key={key}
                      label={label}
                      value={address[key]}
                      onChangeText={(value) =>
                        setAddress({ ...address, [key]: value })
                      }
                    />
                  ))}
                  <Button
                    disabled={busy}
                    onPress={() =>
                      action(async () => {
                        await request(
                          "/profile",
                          {
                            name: address.contact,
                            storeName: address.customer,
                            ...address,
                          },
                          "PATCH",
                        );
                        await load();
                        notify("Do‘kon ma’lumotlari saqlandi");
                      })
                    }
                  >
                    Ma’lumotlarni saqlash
                  </Button>
                  <Button
                    secondary
                    onPress={() => setDetail({ type: "password" })}
                  >
                    Parolni o‘zgartirish
                  </Button>
                  <Button secondary disabled={busy} onPress={logout}>
                    Akkauntdan chiqish
                  </Button>
                </Card>
                <Text style={s.note}>
                  Rasta MVP · Bank to‘lovlari ulanmagan. Buyurtma va qaytarish
                  hisobi platformada yuritiladi.
                </Text>
              </>
            )}
            <Text style={s.footer}>rasta. Savdo uchun yaratilgan.</Text>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL("https://www.flaticon.com/uicons")}><Text style={s.iconCredit}>Uicons by Flaticon</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={s.bottomNav}>
          {[
            ["Katalog", "apps"],
            ["Optomchilar", "shop"],
            ["Savat", "shopping-cart"],
            ["Buyurtmalar", "receipt"],
            ["Profil", "user"],
          ].map(([t, icon]) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: t === tab }}
              accessibilityLabel={t}
              onPress={() => changeTab(t)}
              style={[s.navItem, t === tab && s.navSelected]}
            >
              <View style={s.navIconWrap}>
                {fontsLoaded && <Text accessible={false} style={[s.navIcon, t === tab && s.navTextSelected]}>{icons[icon]}</Text>}
                {t === "Savat" && count > 0 && <Text style={s.cartCount}>{count}</Text>}
              </View>
              <Text style={[s.navLabel, t === tab && s.navTextSelected]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {notice ? (
        <View style={s.toast} accessibilityRole="alert">
          <Text style={s.toastText}>{notice}</Text>
        </View>
      ) : null}
      <Modal
        visible={!!detail}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setDetail(null);
          setError("");
        }}
      >
        <View style={s.modalBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.h2}>
                {detail?.type === "order"
                  ? "Buyurtma tafsilotlari"
                  : detail?.type === "password"
                    ? "Parolni yangilash"
                    : "Mahsulot tafsilotlari"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yopish"
                onPress={() => {
                  setDetail(null);
                  setError("");
                }}
              >
                <Text style={s.remove}>×</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {detail?.type === "product" &&
                (() => {
                  const p = products.find((p) => p.id === detail.id);
                  return p ? (
                    <>
                      <View style={s.detailArt}>
                        <Text style={{ fontSize: 86 }}>{p.emoji}</Text>
                      </View>
                      <Text style={s.heroTitle}>{p.name}</Text>
                      <Text style={s.caption}>
                        {p.category} · {p.sku}
                      </Text>
                      <Text style={s.caption}>
                        {suppliers.find((x) => x.id === p.supplierId)?.name} ·{" "}
                        {p.size}
                      </Text>
                      <Text style={s.total}>{money(p.price)}</Text>
                      <Text style={s.note}>
                        Minimum: {p.minOrder} dona. Omborda: {p.stock} dona.
                      </Text>
                      <Button
                        disabled={p.stock < p.minOrder}
                        onPress={() => {
                          add(p);
                          setDetail(null);
                        }}
                      >
                        Savatga qo‘shish
                      </Button>
                    </>
                  ) : null;
                })()}
              {detail?.type === "order" &&
                (() => {
                  const o = orders.find((o) => o.id === detail.id);
                  return o ? (
                    <>
                      <View style={s.sectionTitle}>
                        <Text style={s.heroTitle}>#{o.id}</Text>
                        <Badge>{o.status}</Badge>
                      </View>
                      <Text style={s.h2}>{o.customer}</Text>
                      <Text style={s.caption}>
                        {o.contact} · {o.phone}
                      </Text>
                      <Text style={s.caption}>
                        {o.city}, {o.address}
                      </Text>
                      <Text style={s.note}>
                        {deliveryName(o.delivery)}
                        {o.courier ? " · " + o.courier : ""}
                      </Text>
                      {o.lines.map((l) => (
                        <View style={s.orderLine} key={l.productId}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.productName}>{l.name}</Text>
                            <Text style={s.caption}>
                              {l.quantity} dona × {money(l.price)}
                            </Text>
                          </View>
                          <Text style={s.price}>
                            {money(l.quantity * l.price)}
                          </Text>
                        </View>
                      ))}
                      <View style={s.totalRow}>
                        <Text style={s.h2}>Jami</Text>
                        <Text style={s.total}>{money(o.total)}</Text>
                      </View>
                      {o.refund && (
                        <Text style={s.error}>
                          Qaytarildi: {o.refund.reason}.{" "}
                          {money(o.refund.amount)}
                        </Text>
                      )}
                      <Text style={s.h2}>Buyurtma tarixi</Text>
                      {o.history.map((h, i) => (
                        <Text key={i} style={s.history}>
                          {h.status} · {new Date(h.at).toLocaleString("en-GB")}
                        </Text>
                      ))}
                    </>
                  ) : null;
                })()}
              {detail?.type === "password" && (
                <PasswordForm
                  error={error}
                  busy={busy}
                  onSubmit={(current, password) =>
                    action(async () => {
                      await request("/password", { current, password });
                      setDetail(null);
                      notify("Parol yangilandi");
                    })
                  }
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function PasswordForm({ onSubmit, busy, error }) {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState("");
  return (
    <View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Input
        label="Joriy parol"
        secureTextEntry
        value={current}
        onChangeText={setCurrent}
      />
      <Input
        label="Yangi parol (kamida 12 belgi)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button disabled={busy} onPress={() => onSubmit(current, password)}>
        Parolni yangilash
      </Button>
    </View>
  );
}
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eaf1eb",
    paddingTop: Platform.OS === "android" ? 30 : 0,
  },
  appShell: { flex: 1, width: "100%", maxWidth: 800, alignSelf: "center" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf1eb",
  },
  authWrap: { flexGrow: 1, justifyContent: "center", padding: 22 },
  authCard: { maxWidth: 430, width: "100%", alignSelf: "center", padding: 28 },
  card: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.95)",
    borderRadius: 22,
    padding: 20,
    shadowColor: "#255c41",
    shadowOpacity: 0.035,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 7 },
  },
  brand: {
    fontSize: 35,
    fontWeight: "800",
    letterSpacing: -2,
    color: colors.ink,
  },
  brandDot: { color: "#429c78" },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#73927d",
    marginTop: 18,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 37,
    letterSpacing: -1,
    marginBottom: 12,
  },
  caption: { fontSize: 12, color: colors.muted, lineHeight: 20 },
  inputField: { marginTop: 16, marginBottom: 4 },
  label: { fontSize: 12, color: "#58735f", marginBottom: 8 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "#ffffffb8",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.ink,
    minHeight: 46,
  },
  button: {
    minHeight: 45,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },
  buttonText: { color: "white", fontSize: 13, fontWeight: "600" },
  secondary: {
    backgroundColor: "#e8f0e9",
    borderWidth: 1,
    borderColor: "#fff",
  },
  demo: { fontSize: 11, color: colors.muted, lineHeight: 19, marginTop: 24 },
  error: {
    backgroundColor: "#fae9df",
    padding: 14,
    borderRadius: 12,
    color: "#974d33",
    fontSize: 13,
    lineHeight: 20,
    marginVertical: 12,
  },
  topbar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#d8e4db",
    backgroundColor: "#eff4efeb",
  },
  topSubtitle: { fontSize: 10, color: colors.muted, marginTop: 3 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dce7d4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "white",
  },
  avatarText: { fontSize: 12, fontWeight: "700", color: "#587653" },
  content: { padding: 20, paddingBottom: 25 },
  hero: { paddingHorizontal: 6, paddingBottom: 22 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#d7e8dca1",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 18,
  },
  heroBadgeText: { fontSize: 10, color: "#5d856c" },
  search: {
    backgroundColor: "#ffffffae",
    borderColor: "#fff",
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    fontSize: 13,
    color: colors.ink,
  },
  chipScroll: { marginVertical: 18 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    marginRight: 8,
    backgroundColor: "#ffffff65",
    borderWidth: 1,
    borderColor: "#fff",
  },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 11, color: "#688270" },
  chipTextSelected: { color: "#fff" },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 12,
  },
  h2: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  productCard: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 18,
    maxWidth: "49%",
  },
  productArt: {
    height: 115,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  productEmoji: { fontSize: 54 },
  productSupplier: { fontSize: 8, color: "#7f9584", marginBottom: 7 },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 19,
  },
  productSize: { fontSize: 9, color: "#7a9180", marginTop: 6, minHeight: 26 },
  price: { fontSize: 13, fontWeight: "700", color: colors.ink, marginTop: 8 },
  minimum: { fontSize: 9, color: "#7a9180", marginTop: 6 },
  empty: {
    textAlign: "center",
    paddingVertical: 35,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 22,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 9,
    paddingBottom: 12,
    backgroundColor: "#f5f8f3ef",
    borderTopWidth: 1,
    borderColor: "#fff",
    shadowColor: "#314a38",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRadius: 12,
    minWidth: 52,
  },
  navSelected: { backgroundColor: "#dbe9dfb0" },
  navIcon: { fontFamily: "RastaIcons", fontSize: 22, color: "#839888", lineHeight: 27 },
  navIconWrap: { position: "relative", height: 27, minWidth: 28, alignItems: "center" },
  iconCredit: { fontSize: 10, color: colors.muted, textAlign: "center", padding: 8 },
  navLabel: { fontSize: 8, color: "#718c7a", marginTop: 4 },
  navTextSelected: { color: "#28684f", fontWeight: "700" },
  cartCount: { fontSize: 9, position: "absolute", right: -12, top: -6, backgroundColor: colors.green, color: "white", borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 },
  footer: {
    fontSize: 10,
    color: "#92a494",
    textAlign: "center",
    marginTop: 30,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: "#dfece1",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 10, color: "#497355" },
  partnerCard: { marginTop: 18 },
  partnerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  partnerIcon: {
    width: 49,
    height: 49,
    backgroundColor: "#e0eacb",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerLetter: { fontSize: 24, fontWeight: "700", color: "#637f4d" },
  supplierFilter: { padding: 6 },
  link: { fontSize: 12, color: colors.green, fontWeight: "600" },
  cartCard: { marginBottom: 14 },
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  cartEmoji: { fontSize: 37 },
  remove: {
    fontSize: 26,
    color: "#6e8979",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quantity: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 18,
  },
  quantityText: { fontSize: 12, color: colors.ink, marginTop: 10 },
  deliveryOptions: { gap: 10, marginTop: 5 },
  deliveryOption: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f0f4ee",
    borderWidth: 1,
    borderColor: "#dce7dc",
  },
  deliverySelected: { borderColor: "#60967a", backgroundColor: "#deeee1" },
  deliveryText: { fontSize: 13, color: colors.green },
  note: { fontSize: 11, color: "#7a8e7e", lineHeight: 18, marginVertical: 15 },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 20,
    borderTopWidth: 1,
    borderColor: "#dce7de",
    paddingTop: 18,
  },
  total: { fontSize: 21, fontWeight: "700", color: colors.ink, marginTop: 8 },
  orderCard: { marginTop: 14 },
  toast: {
    position: "absolute",
    top: 70,
    left: 20,
    right: 20,
    maxWidth: 600,
    alignSelf: "center",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#2c644f",
    zIndex: 50,
  },
  toastText: { fontSize: 13, color: "#fff", textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#173a3060",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: "#edf4ed",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "90%",
    width: "100%",
    maxWidth: 700,
    borderWidth: 1,
    borderColor: "white",
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailArt: {
    height: 180,
    borderRadius: 20,
    backgroundColor: "#dee9dc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  orderLine: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#dce7de",
  },
  history: {
    fontSize: 12,
    color: colors.muted,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#dce7de",
  },
});
