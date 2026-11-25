import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Copy, ExternalLink, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart, totalsByChain } from "@/hooks/useCart";
import { PEDIDOSYA_STORES, pedidosYaSearchUrl } from "@/lib/pedidosya";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

export default function Cart() {
  const navigate = useNavigate();
  const { items, setQty, remove, toggleAdded, clear } = useCart();
  const totals = useMemo(() => totalsByChain(items), [items]);

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

            {/* Total por cadena */}
            <section className="bg-card border border-border/60 rounded-xl p-4 space-y-2">
              <h2 className="font-semibold">¿Dónde conviene?</h2>
              {totals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún producto tiene precios en tiendas cercanas.</p>
              ) : (
                totals.map((t, i) => (
                  <div key={t.store} className="flex items-center justify-between text-sm">
                    <span className={i === 0 ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""}>
                      {t.store}
                      {t.missing > 0 && (
                        <span className="text-xs text-muted-foreground font-normal"> · le falta{t.missing > 1 ? "n" : ""} {t.missing}</span>
                      )}
                    </span>
                    <span className="font-semibold">{money(t.total)}</span>
                  </div>
                ))
              )}
              <p className="text-[11px] text-muted-foreground pt-1">Precios de cuando agregaste cada producto, sin promos bancarias.</p>
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
                      {t && ` · ${money(t.total)}`}
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
                          {p ? money(p.price * item.qty) : "No lo encontramos en esta tienda; probá buscarlo igual"}
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
                  {pyTotal && <span className="text-muted-foreground"> · total estimado {money(pyTotal.total)}</span>}
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
              {pyChain === "PedidosYa Market" && (
                <p className="text-[11px] text-muted-foreground">Los martes, 30% de reintegro en saldo de PedidosYa comprando en el Market.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
