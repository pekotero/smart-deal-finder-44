import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MIN_REVIEWS, reviewSummary } from "@/lib/reviews";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  author: string | null;
  created_at: string;
}

function Stars({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} aria-hidden />
      ))}
    </span>
  );
}

export const useStoreReviews = (storeId: string | undefined) =>
  useQuery({
    queryKey: ["store_reviews", storeId],
    enabled: !!storeId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_reviews")
        .select("id, user_id, rating, comment, author, created_at")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return null; // la tabla todavía no existe
      return (data || []) as Review[];
    },
  });

// "Ana María Pérez" -> "Ana P." (nunca el email).
function shortName(full: unknown): string | null {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return (parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0]).slice(0, 60);
}

// Promedio de estrellas para el encabezado de la tienda (sólo con MIN_REVIEWS reseñas o más).
export function StoreRating({ storeId }: { storeId: string }) {
  const { data } = useStoreReviews(storeId);
  if (!data) return null;
  const s = reviewSummary(data.map((r) => r.rating));
  return (
    <a href="#resenas" className="flex items-center gap-1 text-sm hover:underline">
      {s.avg != null ? (
        <>
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" aria-hidden />
          <span className="font-medium">{s.avg.toFixed(1)}</span>
          <span className="text-muted-foreground">({s.count})</span>
        </>
      ) : (
        <span className="text-muted-foreground">{s.count ? `${s.count} ${s.count === 1 ? "reseña" : "reseñas"}` : "Sin reseñas"}</span>
      )}
    </a>
  );
}

// Reseñas de una sucursal: el promedio aparece recién con MIN_REVIEWS reseñas, para que no lo
// defina una sola opinión. Cada usuario deja una y la puede cambiar.
export default function StoreReviews({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: reviews, isLoading } = useStoreReviews(storeId);
  const mine = reviews?.find((r) => r.user_id === user?.id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
  }, [mine]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Iniciá sesión para dejar una reseña");
      const { error } = await supabase.from("store_reviews").upsert(
        {
          store_id: storeId,
          user_id: user.id,
          rating,
          comment: comment.trim() || null,
          author: shortName(user.user_metadata?.full_name),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_reviews", storeId] });
      setEditing(false);
      toast.success("¡Gracias por tu reseña!");
    },
    onError: (e: Error) => toast.error(/store_reviews/.test(e.message) ? "Las reseñas todavía no están activadas" : e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!mine) return;
      const { error } = await supabase.from("store_reviews").delete().eq("id", mine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_reviews", storeId] });
      toast.success("Reseña borrada");
    },
  });

  if (isLoading || reviews === null) return null;
  const list = reviews || [];
  const s = reviewSummary(list.map((r) => r.rating));
  const showForm = user && (!mine || editing);

  return (
    <section id="resenas" className="container py-6 space-y-4 scroll-mt-16" aria-labelledby="resenas-titulo">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="resenas-titulo" className="text-lg font-semibold">Reseñas</h3>
        {s.avg != null ? (
          <span className="flex items-center gap-2 text-sm">
            <Stars value={s.avg} />
            <span className="font-semibold">{s.avg.toFixed(1)}</span>
            <span className="text-muted-foreground">· {s.count} reseñas</span>
          </span>
        ) : (
          list.length > 0 && (
            <span className="text-xs text-muted-foreground text-right">
              El promedio aparece con {MIN_REVIEWS} reseñas ({list.length} de {MIN_REVIEWS})
            </span>
          )
        )}
      </div>

      {!user ? (
        <div className="rounded-xl border border-dashed p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">¿Compraste acá? Contá cómo te fue con los precios, la atención o el envío.</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>Ingresar</Button>
        </div>
      ) : showForm ? (
        <div className="rounded-xl border p-4 space-y-3 bg-card">
          <p className="text-sm font-medium">{mine ? "Cambiá tu reseña" : "¿Cómo te fue en esta sucursal?"}</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Estrellas">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={rating === i}
                aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
                onClick={() => setRating(i)}
                className="p-1 rounded hover:bg-muted"
              >
                <Star className={`w-6 h-6 ${i <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/40"}`} aria-hidden />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            placeholder="Precios, atención, envío, si había lo que buscabas… (opcional)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            {mine && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
            <Button size="sm" disabled={!rating || save.isPending} onClick={() => save.mutate()}>
              Publicar
            </Button>
          </div>
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía nadie dejó una reseña de esta sucursal.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="rounded-xl border border-border/60 p-3 bg-card space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Stars value={r.rating} size="w-3.5 h-3.5" />
                  <span className="text-xs text-muted-foreground">
                    {r.user_id === user?.id ? "Vos" : r.author || "Usuario"} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
                {r.user_id === user?.id && !editing && (
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => remove.mutate()}>
                      Borrar
                    </Button>
                  </span>
                )}
              </div>
              {r.comment && <p className="text-sm whitespace-pre-line">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
