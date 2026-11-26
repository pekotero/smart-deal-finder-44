// Revisa las alertas de precio y avisa las que se cumplieron: un aviso en la cuenta y, si está
// configurado Resend, un email. Corre todos los días después de cargar precios.
//
//   npx tsx check-alerts.ts            muestra qué avisaría
//   npx tsx check-alerts.ts --write    además guarda los avisos (y manda los emails)
//
// Email (opcional): RESEND_API_KEY, ALERT_EMAIL_FROM ("Ahorrando <avisos@tudominio.com>") y
// SITE_URL (para el link al producto). Sin RESEND_API_KEY sólo se avisa en la cuenta.
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { alertMessage, bestForAlert, shouldNotify, type AlertKind } from "../src/lib/alerts";
import { chainOf } from "../src/lib/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const WRITE = process.argv.includes("--write");
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, ALERT_EMAIL_FROM, SITE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY");
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

interface AlertRow {
  user_id: string;
  product_id: string;
  base_price: number;
  kind: AlertKind;
  target_price: number | null;
  percent: number | null;
  notified_price: number | null;
  store_ids: string[] | null;
}

async function allAlerts(): Promise<AlertRow[]> {
  const out: AlertRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("price_alerts")
      .select("user_id, product_id, base_price, kind, target_price, percent, notified_price, store_ids")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data as AlertRow[]));
    if (!data || data.length < 1000) return out;
  }
}

type PriceRow = { product_id: string; store_id: string; price: number; stores: { name: string } | null };

async function pricesOf(productIds: string[]) {
  const byProduct = new Map<string, PriceRow[]>();
  const names = new Map<string, string>();
  for (let i = 0; i < productIds.length; i += 100) {
    const chunk = productIds.slice(i, i + 100);
    const { data: prods, error: pe } = await db.from("products").select("id, name").in("id", chunk);
    if (pe) throw pe;
    for (const p of prods || []) names.set(p.id, p.name);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("prices")
        .select("product_id, store_id, price, stores(name)")
        .in("product_id", chunk)
        .range(from, from + 999);
      if (error) throw error;
      for (const r of (data || []) as unknown as PriceRow[]) {
        if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
        byProduct.get(r.product_id)!.push(r);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return { byProduct, names };
}

const emails = new Map<string, string | null>();
async function emailOf(userId: string) {
  if (!emails.has(userId)) {
    const { data } = await db.auth.admin.getUserById(userId);
    emails.set(userId, data.user?.email ?? null);
  }
  return emails.get(userId);
}

async function sendEmail(to: string, subject: string, text: string, productId: string) {
  const link = SITE_URL ? `${SITE_URL.replace(/\/$/, "")}/product/${productId}` : "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM || "Alertas de precio <onboarding@resend.dev>",
      to,
      subject,
      text: `${text}${link ? `\n\nVer el producto: ${link}` : ""}\n\nPodés cambiar o quitar la alerta desde la app.`,
    }),
  });
  if (!res.ok) console.warn(`  email no enviado (${res.status}): ${await res.text()}`);
}

async function main() {
  const alerts = await allAlerts();
  console.log(`${alerts.length} alertas`);
  if (!alerts.length) return;
  const { byProduct, names } = await pricesOf([...new Set(alerts.map((a) => a.product_id))]);

  let sent = 0;
  for (const a of alerts) {
    const rows = (byProduct.get(a.product_id) || []).map((r) => ({ store_id: r.store_id, price: r.price, store_name: r.stores?.name }));
    const best = bestForAlert(rows, a.store_ids);
    const rule = {
      kind: a.kind,
      base_price: Number(a.base_price),
      target_price: a.target_price == null ? null : Number(a.target_price),
      percent: a.percent,
      notified_price: a.notified_price == null ? null : Number(a.notified_price),
    };
    if (!best || !shouldNotify(rule, best.price)) continue;
    const name = names.get(a.product_id) || "un producto";
    const msg = alertMessage(name, rule, best.price, chainOf(best.storeName));
    console.log(`→ ${msg.title}: ${msg.body}`);
    sent++;
    if (!WRITE) continue;

    const { error: ne } = await db.from("notifications").insert({ user_id: a.user_id, product_id: a.product_id, ...msg });
    if (ne) {
      console.warn(`  no se guardó el aviso: ${ne.message}`);
      continue;
    }
    const { error: ue } = await db
      .from("price_alerts")
      .update({ notified_price: best.price, notified_at: new Date().toISOString() })
      .eq("user_id", a.user_id)
      .eq("product_id", a.product_id);
    if (ue) console.warn(`  no se actualizó la alerta: ${ue.message}`);
    if (RESEND_API_KEY) {
      const to = await emailOf(a.user_id);
      if (to) await sendEmail(to, msg.title, msg.body, a.product_id);
    }
  }
  console.log(`${sent} avisos${WRITE ? "" : " (modo prueba, no se guardó nada)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
