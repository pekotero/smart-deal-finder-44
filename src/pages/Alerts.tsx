import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, CheckCircle2, Loader2, Pencil, TrendingDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePriceAlerts, type PriceAlert } from "@/hooks/usePriceAlerts";
import { useNotifications } from "@/hooks/useNotifications";
import PriceAlertDialog from "@/components/PriceAlertDialog";
import { alertMet, bestForAlert, describeRule } from "@/lib/alerts";
import { chainOf } from "@/lib/chains";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

type Row = { id: string; name: string; image_url: string | null; prices: { store_id: string; price: number; stores: { name: string } | null }[] };

// Avisos de la cuenta y alertas de precio. El estado de cada alerta usa la misma regla que el
// script diario (lib/alerts): el mejor precio entre las tiendas que mira.
export default function Alerts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { alerts, isLoading, isError, removeAlert } = usePriceAlerts();
  const { notifications, unread, markAllRead, removeNotification } = useNotifications();
  const [editing, setEditing] = useState<PriceAlert | null>(null);
  const ids = alerts.map((a) => a.product_id);

  // Al entrar se marcan como leídos (queda resaltado lo nuevo hasta salir).
  const [fresh] = useState(() => new Set<string>());
  useEffect(() => {
    if (unread === 0) return;
    notifications.filter((n) => !n.read_at).forEach((n) => fresh.add(n.id));
    markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ["alert_products", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, image_url, prices(store_id, price, stores(name))").in("id", ids);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  const items = alerts
    .map((a) => {
      const p = products.find((x) => x.id === a.product_id);
      const best = bestForAlert(
        (p?.prices || []).map((r) => ({ store_id: r.store_id, price: r.price, store_name: r.stores?.name })),
        a.store_ids,
      );
      const now = best?.price ?? null;
      const drop = now != null && now < a.base_price ? Math.round(((a.base_price - now) / a.base_price) * 100) : 0;
      return { alert: a, product: p, now, store: best ? chainOf(best.storeName) : "", drop, met: alertMet(a, now) };
    })
    .sort((x, y) => Number(y.met) - Number(x.met) || y.drop - x.drop);

  const loading = isLoading || (ids.length > 0 && prodLoading);
  const editingProduct = editing && products.find((p) => p.id === editing.product_id);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold flex-1">Avisos y alertas</h1>
        </div>
      </header>

      <main className="container max-w-3xl py-6 space-y-8">
        {!user ? (
          <div className="text-center py-16 space-y-4">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Iniciá sesión para guardar alertas de precio.</p>
            <Button onClick={() => navigate("/auth")}>Ingresar</Button>
          </div>
        ) : (
          <>
            {notifications.length > 0 && (
              <section className="space-y-2" aria-labelledby="avisos">
                <h2 id="avisos" className="font-semibold">Avisos</h2>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 rounded-xl p-3 border ${fresh.has(n.id) ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"}`}
                  >
                    <TrendingDown className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      {n.product_id ? (
                        <Link to={`/product/${n.product_id}`} className="text-sm font-medium hover:text-primary line-clamp-2">
                          {n.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium">{n.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {n.body} · {when(n.created_at)}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 w-7 h-7 text-muted-foreground" onClick={() => removeNotification(n.id)} aria-label="Borrar aviso">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-3" aria-labelledby="mis-alertas">
              <h2 id="mis-alertas" className="font-semibold">Mis alertas</h2>
              {isError ? (
                <p className="text-muted-foreground text-center py-10">Las alertas todavía no están activadas.</p>
              ) : loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground">No tenés alertas. En cada producto tocá «Alerta de precio».</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Revisamos los precios todos los días y, si se cumple una alerta, te avisamos acá. Mira todas las tiendas que veías
                    al crearla, así te enterás aunque la baja sea en otra.
                  </p>
                  {items.map(({ alert, product, now, store, drop, met }) => (
                    <div
                      key={alert.product_id}
                      className={`flex items-center gap-3 rounded-xl p-3 border ${met ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-card"}`}
                    >
                      {product?.image_url && <img src={product.image_url} alt="" className="w-12 h-12 object-contain rounded-lg bg-secondary/40 shrink-0" />}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <Link to={`/product/${alert.product_id}`} className="text-sm font-medium line-clamp-2 hover:text-primary">
                          {product?.name || "Producto"}
                        </Link>
                        <p className="text-xs text-muted-foreground">{describeRule(alert)}</p>
                        <p className="text-xs">
                          {now == null ? (
                            <span className="text-muted-foreground">Sin precios por ahora</span>
                          ) : met ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Se cumplió: {money(now)} en {store}
                              {drop > 0 && ` (−${drop}%)`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Hoy {money(now)} en {store}
                              {drop > 0 && ` · bajó ${drop}%`}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setEditing(alert)} aria-label="Cambiar alerta">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => removeAlert(alert.product_id)} aria-label="Quitar alerta">
                        <BellOff className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {editing && (
        <PriceAlertDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          productId={editing.product_id}
          productName={editingProduct?.name || "Producto"}
          bestPrice={editing.base_price}
          storeIds={editing.store_ids || []}
        />
      )}
    </div>
  );
}
