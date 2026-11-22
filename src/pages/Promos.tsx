import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, ExternalLink, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import BottomNav from "@/components/BottomNav";
import { useBankPromos, usePromoPrefs } from "@/hooks/useBankPromos";
import { activePromos, fmtMoney, norm, today, WEEK, type BankPromo } from "@/lib/promos";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const PromoCard = ({ p }: { p: BankPromo }) => (
  <article className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{p.medio}</p>
        <h3 className="text-lg font-semibold text-foreground leading-tight">{p.cadena}</h3>
        {p.aplica_a.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">{p.aplica_a.join(" · ")}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-3xl font-bold text-success leading-none">{p.descuento}%</p>
        <p className="text-xs text-muted-foreground mt-1">{p.tipo}</p>
      </div>
    </div>

    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary">{p.dias.length ? p.dias.map(cap).join(", ") : "Todos los días"}</Badge>
      {p.tope ? (
        <Badge variant="secondary">
          Tope {fmtMoney(p.tope)}
          {p.tope_periodo ? ` por ${p.tope_periodo}` : ""}
        </Badge>
      ) : (
        <Badge variant="secondary">Sin tope</Badge>
      )}
      {p.minimo_compra ? <Badge variant="secondary">Compra mínima {fmtMoney(p.minimo_compra)}</Badge> : null}
      {p.online === true && <Badge variant="outline">Sólo online</Badge>}
      {p.online === false && <Badge variant="outline">Sólo en sucursal</Badge>}
      {p.vigencia_hasta && <Badge variant="outline">Hasta el {fmtDate(p.vigencia_hasta)}</Badge>}
      {p.confianza === "baja" && (
        <Badge variant="outline" className="border-accent text-accent">
          Sin confirmar
        </Badge>
      )}
    </div>

    {p.requisitos && (
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer text-foreground/80 font-medium">Condiciones</summary>
        <p className="mt-2 leading-relaxed">{p.requisitos}</p>
      </details>
    )}

    {p.fuente && (
      <a
        href={p.fuente}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary inline-flex items-center gap-1 hover:underline self-start"
      >
        Ver fuente <ExternalLink className="w-3.5 h-3.5" />
      </a>
    )}
  </article>
);

const Promos = () => {
  const navigate = useNavigate();
  const { data: promos = [], isLoading, error } = useBankPromos();
  const allMedios = useMemo(() => [...new Set(promos.map((p) => p.medio))].sort(), [promos]);
  const { medios, day, toggleMedio, setDay, setAll } = usePromoPrefs(allMedios);
  const [cadena, setCadena] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [withOnline, setWithOnline] = useState(true);

  const forDay = useMemo(() => activePromos(promos, { medios, day }), [promos, medios, day]);
  const cadenas = useMemo(() => [...new Set(forDay.map((p) => p.cadena))].sort(), [forDay]);

  const shown = useMemo(() => {
    const q = norm(query);
    return forDay
      .filter((p) => withOnline || p.online !== true)
      .filter((p) => !cadena || p.cadena === cadena)
      .filter((p) => !q || norm([p.medio, p.cadena, ...p.aplica_a, p.tipo, p.requisitos].join(" ")).includes(q))
      .sort((a, b) => (b.descuento ?? 0) - (a.descuento ?? 0));
  }, [forDay, withOnline, cadena, query]);

  const now = today();

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-8">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Promos bancarias</h1>
            <p className="text-xs text-muted-foreground">Descuentos y reintegros en supermercados</p>
          </div>
        </div>
      </header>

      <main className="container py-6 flex flex-col gap-6">
        <section className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> ¿Cómo pagás?
              </p>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setAll(true)} className="text-primary hover:underline">
                  Todos
                </button>
                <button onClick={() => setAll(false)} className="text-primary hover:underline">
                  Ninguno
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {allMedios.map((m) => {
                const on = medios.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMedio(m)}
                    aria-pressed={on}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-transparent hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">¿Qué día comprás?</p>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
              {WEEK.map((d) => (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  aria-pressed={day === d}
                  className={`px-3 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors ${
                    day === d
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {cap(d)}
                  {d === now ? " (hoy)" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar banco, súper o condición (ej. carnes, QR, MODO)"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary border-2 border-transparent focus:border-primary focus:bg-card outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Switch checked={withOnline} onCheckedChange={setWithOnline} />
              Incluir sólo online
            </label>
          </div>
        </section>

        {cadenas.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[null, ...cadenas].map((c) => (
              <button
                key={c ?? "all"}
                onClick={() => setCadena(c)}
                className={`px-3 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors ${
                  cadena === c
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {c ?? "Todos los súper"}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-center text-muted-foreground py-12">No se pudieron cargar las promos.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground -mb-2">
              {shown.length} {shown.length === 1 ? "promo" : "promos"} para el {day}
              {medios.length < allMedios.length ? " con tus medios de pago" : ""}. Revisá topes y condiciones
              antes de comprar.
            </p>
            {shown.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                {medios.length === 0 ? "Elegí al menos un medio de pago." : "No hay promos con esos filtros."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shown.map((p) => (
                  <PromoCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav activeTab="promos" onTabChange={(t) => navigate(t === "promos" ? "/promos" : t === "home" ? "/" : `/?tab=${t}`)} />
    </div>
  );
};

export default Promos;
