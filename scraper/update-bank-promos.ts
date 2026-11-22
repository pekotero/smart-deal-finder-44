// Reemplaza la tabla bank_promos con el contenido de promos-bancarias.json.
// Uso: cd scraper && npx tsx update-bank-promos.ts [archivo.json]
// Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY (en scraper/.env o en el .env de la raíz).
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const p of [path.resolve(__dirname, ".env"), path.resolve(__dirname, "../.env")]) {
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("ERROR: faltan SUPABASE_URL y SUPABASE_SERVICE_KEY (la secret key, no la publishable).");
  process.exit(1);
}

interface PromoJson {
  medio: string;
  cadena: string;
  aplicaA?: string[];
  dias?: string[];
  descuento?: number | null;
  tipo?: string | null;
  tope?: number | null;
  topePeriodo?: string | null;
  minimoCompra?: number | null;
  requisitos?: string | null;
  online?: boolean | null;
  vigencia?: { desde?: string | null; hasta?: string | null } | null;
  fuente?: string | null;
  confianza?: string | null;
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const file = path.resolve(process.cwd(), process.argv[2] || path.join(__dirname, "promos-bancarias.json"));
const { actualizado, promos } = JSON.parse(fs.readFileSync(file, "utf8")) as { actualizado?: string; promos: PromoJson[] };

const problems: string[] = [];
const rows = promos.map((p, i) => {
  const where = `#${i} ${p.medio} / ${p.cadena}`;
  if (!p.medio || !p.cadena) problems.push(`${where}: falta medio o cadena`);
  for (const d of p.dias || []) if (!DAYS.includes(d)) problems.push(`${where}: día inválido "${d}"`);
  for (const f of [p.vigencia?.desde, p.vigencia?.hasta]) {
    if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) problems.push(`${where}: fecha inválida "${f}"`);
  }
  return {
    medio: p.medio,
    cadena: p.cadena,
    aplica_a: p.aplicaA || [],
    dias: p.dias || [],
    descuento: p.descuento ?? null,
    tipo: p.tipo ?? null,
    tope: p.tope ?? null,
    tope_periodo: p.topePeriodo ?? null,
    minimo_compra: p.minimoCompra ?? null,
    requisitos: p.requisitos ?? null,
    online: p.online ?? null,
    vigencia_desde: p.vigencia?.desde ?? null,
    vigencia_hasta: p.vigencia?.hasta ?? null,
    fuente: p.fuente ?? null,
    confianza: p.confianza ?? null,
  };
});

if (problems.length) {
  console.error("No se cargó nada. Problemas en el JSON:\n" + problems.join("\n"));
  process.exit(1);
}

const supabase = createClient(url, key, { realtime: { transport: { WebSocket: null } } as never });

const { error: delError } = await supabase.from("bank_promos").delete().not("id", "is", null);
if (delError) throw delError;
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await supabase.from("bank_promos").insert(rows.slice(i, i + 200));
  if (error) throw error;
}
console.log(`Listo: ${rows.length} promos cargadas${actualizado ? ` (relevadas el ${actualizado})` : ""}.`);
