import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Loader2, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useStores } from "@/hooks/useStores";
import { chainOf } from "@/hooks/useProducts";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

type Row = { id: string; name: string; image_url: string | null; prices: { price: number; stores: { name: string } | null }[] };

// Alertas de precio: muestra cuáles bajaron desde que se crearon (mejor precio en cadenas cercanas).
export default function Alerts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { alerts, isLoading, isError, toggleAlert } = usePriceAlerts();
  const { latitude, longitude, loading: locLoading } = useGeolocation();
  const { data: nearby, isLoading: storesLoading } = useStores({
    userLatitude: latitude,
    userLongitude: longitude,
    maxDistanceKm: 30,
    enabled: !locLoading,
  });
  const ids = alerts.map((a) => a.product_id);
  const nearChains = new Set(nearby.map((s) => chainOf(s.name || "")));

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ["alert_products", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, image_url, prices(price, stores(name))").in("id", ids);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  const items = alerts.map((a) => {
    const p = products.find((x) => x.id === a.product_id);
    const near = (p?.prices || []).filter((pr) => nearChains.has(chainOf(pr.stores?.name || ""))).map((pr) => Number(pr.price));
    const now = near.length ? Math.min(...near) : null;
    const drop = now != null && now < a.base_price ? Math.round(((a.base_price - now) / a.base_price) * 100) : 0;
    return { alert: a, product: p, now, drop };
  }).sort((x, y) => y.drop - x.drop);

  const loading = isLoading || prodLoading || locLoading || storesLoading;

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold flex-1">Alertas de precio</h1>
        </div>
      </header>

      <main className="container max-w-3xl py-6 space-y-3">
        {!user ? (
          <div className="text-center py-16 space-y-4">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Iniciá sesión para guardar alertas de precio.</p>
            <Button onClick={() => navigate("/auth")}>Ingresar</Button>
          </div>
        ) : isError ? (
          <p className="text-muted-foreground text-center py-16">Las alertas todavía no están activadas.</p>
        ) : loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">No tenés alertas. En cada producto tocá «Avisame si baja».</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Comparamos el mejor precio de hoy en las cadenas cercanas con el que había cuando creaste la alerta.
            </p>
            {items.map(({ alert, product, now, drop }) => (
              <div
                key={alert.product_id}
                className={`flex items-center gap-3 rounded-xl p-3 border ${drop > 0 ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-card"}`}
              >
                {product?.image_url && <img src={product.image_url} alt="" className="w-12 h-12 object-contain rounded-lg bg-secondary/40 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${alert.product_id}`} className="text-sm font-medium line-clamp-2 hover:text-primary">
                    {product?.name || "Producto"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {drop > 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" aria-hidden /> Bajó {drop}%: {money(alert.base_price)} → {money(now!)}
                      </span>
                    ) : now != null ? (
                      `Sin baja: ${money(now)} (era ${money(alert.base_price)})`
                    ) : (
                      "Sin precios cerca tuyo"
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => toggleAlert(alert.product_id, alert.base_price)} aria-label="Quitar alerta">
                  <BellOff className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
