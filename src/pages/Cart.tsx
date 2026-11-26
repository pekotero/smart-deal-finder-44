import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarCheck, Check, Copy, ExternalLink, Minus, Plus, ShoppingCart, Split, Store, Trash2, TrendingDown } from "lucide-react";
import { bestEverywhere, bestSingle, bestSplit, chainsIn, type Plan, type PromoFor } from "@/lib/cart-plan";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart, totalsByChain } from "@/hooks/useCart";
import { lineCost } from "@/lib/qty-promo";
import { PEDIDOSYA_STORES, pedidosYaSearchUrl } from "@/lib/pedidosya";
import { useBankPromos, usePromoPrefs } from "@/hooks/useBankPromos";
import { bestPromoForChain, promoLabel, today, WEEK } from "@/lib/promos";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

export default function Cart() {
  const navigate = useNavigate();
  const { items, setQty, remove, toggleAdded, clear } = useCart();
  const { data: promos = [] } = useBankPromos();
  const allMedios = useMemo(() => [...new Set(promos.map((p) => p.medio))].sort(), [promos]);
  const { medios, day, setDay } = usePromoPrefs(allMedios);

  // Total de cada cadena con la mejor promo del día para tus medios de pago. Primero las que
  // tienen todos los productos y, entre ellas, la que sale más barata con la promo.
  const totals = useMemo(
    () =>
      totalsByChain(items)
        .map((t) => {
          const best = bestPromoForChain(promos, t.store, { medios, day }, t.total);
          const save = best?.save ?? 0;
          return { ...t, promo: best?.promo ?? null, save, missingForPromo: best?.missing, final: t.total - save };
        })
        .sort((a, b) => a.missing - b.missing || a.final - b.final),
    [items, promos, medios, day],
  );

  // Planes para cada día de la semana: todo en un super o repartido entre dos, con las promos de
  // ese día. Sirve para el plan de hoy y para ver qué día conviene comprar.
  const plans = useMemo(() => {
    const chains = chainsIn(items);
    return WEEK.map((d) => {
      const promoFor: PromoFor = (chain, subtotal) => bestPromoForChain(promos, chain, { medios, day: d }, subtotal);
      return {
        day: d,
        single: bestSingle(items, chains, promoFor),
        split: bestSplit(items, chains, promoFor),
        everywhere: bestEverywhere(items, chains, promoFor),
      };
    });
  }, [items, promos, medios]);
  const plan = plans.find((p) => p.day === day);
  // Repartir conviene si cubre al menos lo mismo y ahorra algo que valga el segundo viaje.
  const splitWorth = (single: Plan | null, split: Plan | null) =>
    !!single && !!split && split.missing.length <= single.missing.length && single.final - split.final >= Math.max(500, single.final * 0.03);
  // El mejor plan de cada día: repartido si conviene, si no todo en un super.
  const bestPlan = (p: (typeof plans)[number]) => (splitWorth(p.single, p.split) ? p.split! : p.single);
  const dayTotal = (p: (typeof plans)[number]) => bestPlan(p)?.final ?? 0;
  const dayName = (d: string) => (d === today() ? "hoy" : `el ${d}`);
  const fewestMissing = Math.min(...plans.map((p) => p.single?.missing.length ?? Infinity));
  const bestDay = plans
    .filter((p) => p.single && p.single.missing.length === fewestMissing)
    .reduce<(typeof plans)[number] | null>((b, p) => (!b || dayTotal(p) < dayTotal(b) ? p : b), null);

  // Tiendas de PedidosYa, ordenadas como el resumen (primero la que tiene más productos y es más barata).
  const pyChains = useMemo(() => {
    const ranked = totals.map((t) => t.store).filter((s) => s in PEDIDOSYA_STORES);
    return [...ranked, ...Object.keys(PEDIDOSYA_STORES).filter((s) => !ranked.includes(s))];
  }, [totals]);
  const [chosen, setChosen] = useState<string | null>(null);
  const pyChain = chosen && pyChains.includes(chosen) ? chosen : pyChains[0];
  const pyTotal = totals.find((t) => t.store === pyChain);
  const addedCount = items.filter((i) => i.added?.includes(pyChain)).length;

  const copyList = async () => {
    const lines = items.map((i) => {
      const p = i.prices.find((x) => x.store === pyChain);
      return `${i.qty} x ${i.name}${p ? ` — ${money(p.price)}` : ""}`;
    });
    try {
      await navigator.clipboard.writeText(`Lista para ${pyChain}:\n${lines.join("\n")}`);
      toast.success("Lista copiada");
    } catch {
      toast.error("No se pudo copiar la lista");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold flex-1">Mi carrito</h1>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
              <Trash2 className="w-4 h-4 mr-1.5" /> Vaciar
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-3xl py-6 space-y-6">
        {items.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Tu carrito está vacío. Agregá productos desde el inicio.</p>
            <Button onClick={() => navigate("/")}>Ver productos</Button>
          </div>
        ) : (
          <>
            {/* Productos */}
            <section className="space-y-2">
              {items.map((item) => {
                const best = item.prices.length ? Math.min(...item.prices.map((p) => p.price)) : null;
                return (
                  <div key={item.id} className="flex items-center gap-3 bg-card border border-border/60 rounded-xl p-3">
                    <img src={item.image} alt="" className="w-14 h-14 object-contain rounded-lg bg-secondary/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.id}`} className="text-sm font-medium line-clamp-2 hover:text-primary">
                        {item.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {best !== null ? `desde ${money(best)}` : "sin precios cerca"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(item.id, item.qty - 1)} aria-label="Uno menos">
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(item.id, item.qty + 1)} aria-label="Uno más">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => remove(item.id)} aria-label="Quitar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Plan de compra: qué día y dónde (en uno o dos supers) */}
            {plan?.single && (
              <section className="bg-card border border-border/60 rounded-xl p-4 space-y-4">
                <div>
                  <h2 className="font-semibold">Tu plan de compra</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Con la mejor promo de tus medios de pago para cada día.{" "}
                    <Link to="/promos" className="underline">Cambiar medios de pago</Link>
                  </p>
                </div>

                {/* Qué día conviene: total del mejor super de cada día */}
                <div className="grid grid-cols-7 gap-1">
                  {plans.map((p) => {
                    const isBest = bestDay?.day === p.day;
                    return (
                      <button
                        key={p.day}
                        onClick={() => setDay(p.day)}
                        aria-pressed={p.day === day}
                        className={`rounded-lg px-0.5 py-1.5 text-center border transition-colors ${
                          p.day === day ? "border-primary bg-primary/10" : "border-transparent bg-secondary/50 hover:border-border"
                        }`}
                      >
                        <span className="block text-[11px] capitalize font-medium">{p.day === today() ? "hoy" : p.day.slice(0, 3)}</span>
                        <span className={`block text-[10px] ${isBest ? "font-bold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {p.single ? money(dayTotal(p)) : "—"}
                          {splitWorth(p.single, p.split) && <span className="sr-only"> repartido</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {bestDay && bestDay.day !== day && dayTotal(plan) - dayTotal(bestDay) >= 1 && (
                  <button
                    onClick={() => setDay(bestDay.day)}
                    className="w-full flex items-center gap-2 text-left text-sm rounded-lg p-2.5 bg-emerald-500/10 border border-emerald-500/30"
                  >
                    <CalendarCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
                    <span>
                      Si comprás <b>{dayName(bestDay.day)}</b>{" "}
                      {bestPlan(bestDay)!.parts.length > 1 ? "repartido en " : "en "}
                      {bestPlan(bestDay)!.parts.map((x) => x.chain).join(" y ")} pagás {money(dayTotal(bestDay))}:{" "}
                      <b>{money(dayTotal(plan) - dayTotal(bestDay))} menos</b> que {dayName(day)}.
                    </span>
                  </button>
                )}

                {/* Todo en un super vs. repartido */}
                <div className="space-y-2">
                  <div className="rounded-lg p-2.5 bg-secondary/40">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Store className="w-4 h-4 text-muted-foreground" aria-hidden /> Todo en {plan.single.parts[0]?.chain}
                      </span>
                      <span className="font-bold">{money(plan.single.final)}</span>
                    </div>
                    {plan.single.missing.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        No tiene: {plan.single.missing.map((i) => i.name).join(", ")}
                      </p>
                    )}
                  </div>

                  {plan.split && splitWorth(plan.single, plan.split) ? (
                    <div className="rounded-lg p-2.5 bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                          <Split className="w-4 h-4" aria-hidden /> Repartido en {plan.split.parts.map((x) => x.chain).join(" y ")}
                        </span>
                        <span className="text-right">
                          <span className="font-bold">{money(plan.split.final)}</span>
                          <span className="block text-[11px] text-emerald-700 dark:text-emerald-400">
                            ahorrás {money(plan.single.final - plan.split.final)}
                          </span>
                        </span>
                      </div>
                      {plan.split.parts.map((part) => (
                        <div key={part.chain} className="text-xs">
                          <p className="font-medium">
                            En {part.chain}: {money(part.final)}
                            {part.save > 0 && <span className="text-muted-foreground font-normal"> (con promo, ahorrás {money(part.save)})</span>}
                          </p>
                          <p className="text-muted-foreground">{part.items.map((i) => `${i.qty} × ${i.name}`).join(" · ")}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    plan.split && (
                      <p className="text-xs text-muted-foreground">
                        Repartir entre dos supers no conviene: ahorrarías{" "}
                        {plan.single.final > plan.split.final ? `solo ${money(plan.single.final - plan.split.final)}` : "nada"}.
                      </p>
                    )
                  )}

                  {/* Máximo ahorro: cada producto donde está más barato (más de dos supers) */}
                  {plan.everywhere && plan.everywhere.missing.length <= plan.single.missing.length && bestPlan(plan)!.final - plan.everywhere.final >= 1 && (
                    <details className="rounded-lg p-2.5 bg-secondary/40 group">
                      <summary className="flex items-center justify-between gap-2 text-sm cursor-pointer list-none">
                        <span className="flex items-center gap-1.5 font-medium">
                          <TrendingDown className="w-4 h-4 text-muted-foreground" aria-hidden /> Máximo ahorro, en {plan.everywhere.parts.length} supers
                        </span>
                        <span className="text-right">
                          <span className="font-bold">{money(plan.everywhere.final)}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {money(bestPlan(plan)!.final - plan.everywhere.final)} menos
                          </span>
                        </span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        <p className="text-[11px] text-muted-foreground">
                          Cada producto donde está más barato. Cada super es otro viaje o, en PedidosYa, otro envío: fijate si el ahorro lo vale.
                        </p>
                        {plan.everywhere.parts.map((part) => (
                          <div key={part.chain} className="text-xs">
                            <p className="font-medium">
                              En {part.chain}: {money(part.final)}
                              {part.save > 0 && <span className="text-muted-foreground font-normal"> (con promo, ahorrás {money(part.save)})</span>}
                            </p>
                            <p className="text-muted-foreground">{part.items.map((i) => `${i.qty} × ${i.name}`).join(" · ")}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </section>
            )}

            {/* Total por cadena, con promos */}
            <section className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="font-semibold">Total en cada super</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {day === today() ? "Hoy" : <span className="capitalize">{day}</span>}, con la mejor promo de tus medios de pago.
                </p>
              </div>
              {totals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún producto tiene precios en tiendas cercanas.</p>
              ) : (
                <div className="space-y-2">
                  {totals.map((t, i) => (
                    <div key={t.store} className={`rounded-lg p-2.5 ${i === 0 && t.missing === 0 ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-secondary/40"}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className={i === 0 && t.missing === 0 ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-medium"}>
                          {t.store}
                          {t.missing > 0 && (
                            <span className="text-xs text-muted-foreground font-normal"> · le falta{t.missing > 1 ? "n" : ""} {t.missing}</span>
                          )}
                        </span>
                        <span className="text-right shrink-0">
                          <span className="font-bold">{money(t.final)}</span>
                          {t.save > 0 && <span className="block text-[11px] text-muted-foreground line-through">{money(t.total)}</span>}
                        </span>
                      </div>
                      {t.promo && t.save > 0 && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {promoLabel(t.promo)} · ahorrás {money(t.save)}
                          {t.promo.tipo === "reintegro" && " (te lo devuelven después)"}
                        </p>
                      )}
                      {t.promo && t.missingForPromo && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Con {money(t.missingForPromo)} más entrás en {promoLabel(t.promo)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Precios de cuando agregaste cada producto. Revisá topes y condiciones de cada promo.
              </p>
            </section>

            {/* Armar en PedidosYa */}
            <section className="bg-card border border-border/60 rounded-xl p-4 space-y-4">
              <div>
                <h2 className="font-semibold">Armar el pedido en PedidosYa</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  PedidosYa no deja que otra app le cargue el carrito. Cada botón abre la tienda buscando ese producto:
                  tocás «Agregar» allá y lo marcás acá.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {pyChains.map((c) => {
                  const t = totals.find((x) => x.store === c);
                  return (
                    <button
                      key={c}
                      onClick={() => setChosen(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        c === pyChain ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-transparent hover:border-border"
                      }`}
                    >
                      {c}
                      {t && ` · ${money(t.final)}`}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const p = item.prices.find((x) => x.store === pyChain);
                  const url = pedidosYaSearchUrl(pyChain, item.name);
                  const done = item.added?.includes(pyChain) ?? false;
                  return (
                    <div key={item.id} className={`flex items-center gap-3 rounded-lg p-2 ${done ? "bg-emerald-500/10" : "bg-secondary/40"}`}>
                      <button
                        onClick={() => toggleAdded(item.id, pyChain)}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${
                          done ? "bg-emerald-600 border-emerald-600 text-white" : "border-border bg-background"
                        }`}
                        aria-label={done ? "Marcar como no agregado" : "Marcar como agregado"}
                      >
                        {done && <Check className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm line-clamp-1 ${done ? "line-through text-muted-foreground" : ""}`}>
                          {item.qty} × {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p ? money(lineCost(p.price, item.qty, p.promo)) : "No lo encontramos en esta tienda; probá buscarlo igual"}
                        </p>
                      </div>
                      {url && (
                        <Button asChild variant="outline" size="sm" className="shrink-0 h-8 text-xs">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            Buscar <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-sm">
                  {addedCount} de {items.length} agregados
                  {pyTotal && <span className="text-muted-foreground"> · total estimado {money(pyTotal.final)}</span>}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyList}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar lista
                  </Button>
                  <Button asChild size="sm">
                    <a href={PEDIDOSYA_STORES[pyChain]} target="_blank" rel="noopener noreferrer">
                      Abrir tienda <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </a>
                  </Button>
                </div>
              </div>
              {pyTotal?.promo && pyTotal.save > 0 && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Incluye {promoLabel(pyTotal.promo)}: pagá con ese medio en PedidosYa.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
