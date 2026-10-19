// Reads the warehouse's CSV export and pushes it whenever its content changes.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseCSV } from "../packages/domain/index.js";
const { RASTA_API_URL, RASTA_API_KEY, WAREHOUSE_CSV } = process.env;
if (!RASTA_API_URL || !RASTA_API_KEY || !WAREHOUSE_CSV)
  throw new Error("RASTA_API_URL, RASTA_API_KEY va WAREHOUSE_CSV kerak.");
let previous = "";
async function sync() {
  try {
    const csv = await readFile(WAREHOUSE_CSV, "utf8"),
      hash = createHash("sha256").update(csv).digest("hex");
    if (hash === previous) return;
    const r = await fetch(
      `${RASTA_API_URL.replace(/\/$/, "")}/api/integrations/sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RASTA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ products: parseCSV(csv) }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok) throw new Error((await r.json()).error);
    previous = hash;
    console.log(new Date().toISOString(), "Sinxronlandi");
  } catch (e) {
    console.error("Sinxronlash xatosi:", e.message);
  }
}
await sync();
if (process.env.SYNC_ONCE !== "true") {
  const interval = Math.max(
    30000,
    Number(process.env.SYNC_INTERVAL_MS) || 60000,
  );
  setInterval(sync, interval);
}
