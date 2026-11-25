import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chainOf } from "@/hooks/useProducts";
import { bestPriceChange, chainColor, historyRows, MAX_SERIES, type HistoryPoint } from "@/lib/history";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Cómo cambió el precio de un producto en las cadenas cercanas (las que muestra el detalle).
export default function PriceHistory({ productId, chains }: { productId: string; chains: string[] }) {
  const shown = chains.slice(0, MAX_SERIES);
  const { data: points = [], isLoading, isError } = useQuery({
    retry: false,
    queryKey: ["price_history", productId],
    queryFn: async (): Promise<HistoryPoint[]> => {
      const { data, error } = await supabase
        .from("price_history")
        .select("price, recorded_on, stores(name)")
        .eq("product_id", productId)
        .order("recorded_on");
      // Sin la tabla de historial (todavía no se creó) no se muestra nada.
      if (error) throw error;
      return (data || []).map((r) => ({
        chain: chainOf((r.stores as { name: string } | null)?.name || ""),
        date: r.recorded_on,
        price: Number(r.price),
      }));
    },
  });

  if (isLoading || isError || !shown.length) return null;
  const mine = points.filter((p) => shown.includes(p.chain));
  const rows = historyRows(mine, shown);
  const change = bestPriceChange(mine, shown);

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Cómo cambió el precio</h3>
      {rows.length < 2 ? (
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4">
          Todavía hay un solo día registrado. El historial se arma con cada actualización diaria de precios.
        </p>
      ) : (
        <>
          {change && change.pct !== 0 && (
            <p className="text-sm flex items-center gap-1.5">
              {change.pct < 0 ? (
                <TrendingDown className="w-4 h-4 text-emerald-600" aria-hidden />
              ) : (
                <TrendingUp className="w-4 h-4 text-rose-500" aria-hidden />
              )}
              El mejor precio {change.pct < 0 ? "bajó" : "subió"} {Math.abs(change.pct)}%: de {money(change.from)} a {money(change.to)}
            </p>
          )}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis
                  width={64}
                  tickFormatter={money}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [money(v), name]}
                  labelFormatter={(d: string) => shortDate(d)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} iconType="plainline" />
                {shown.map((c) => (
                  <Line
                    key={c}
                    type="stepAfter"
                    dataKey={c}
                    name={c}
                    stroke={chainColor(c, shown)}
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: chainColor(c, shown) }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Ver como tabla</summary>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pr-3 py-1 font-medium">Día</th>
                    {shown.map((c) => (
                      <th key={c} className="pr-3 py-1 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.date)} className="border-t border-border/50">
                      <td className="pr-3 py-1">{shortDate(String(r.date))}</td>
                      {shown.map((c) => (
                        <td key={c} className="pr-3 py-1">{typeof r[c] === "number" ? money(r[c] as number) : "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
