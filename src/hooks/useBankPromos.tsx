import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { today, type BankPromo } from "@/lib/promos";

// Promos vigentes o futuras (las vencidas no se bajan).
export const useBankPromos = () => {
  return useQuery({
    queryKey: ["bank_promos"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const d = new Date();
      const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("bank_promos")
        .select("*")
        .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${todayIso}`)
        .order("descuento", { ascending: false });
      if (error) throw error;
      return (data || []) as BankPromo[];
    },
  });
};

// Medios de pago y día de compra elegidos. Se guardan en el navegador y se comparten entre
// la pestaña Promos y las tarjetas de tiendas.
const KEY = "promoPrefs";
const EVENT = "promo-prefs-change";

interface PromoPrefs {
  medios: string[] | null; // null = todavía no eligió: se toman todos
  day: string | null; // null = hoy
}

const read = (): PromoPrefs => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") return { medios: Array.isArray(v.medios) ? v.medios : null, day: v.day || null };
  } catch {
    /* sin preferencias guardadas */
  }
  return { medios: null, day: null };
};

export const usePromoPrefs = (allMedios: string[]) => {
  const [prefs, setPrefs] = useState<PromoPrefs>(read);

  useEffect(() => {
    const sync = () => setPrefs(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((next: PromoPrefs) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* navegador sin storage: queda sólo en memoria */
    }
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const medios = prefs.medios ?? allMedios;
  const day = prefs.day ?? today();

  const toggleMedio = (m: string) =>
    save({ ...prefs, medios: medios.includes(m) ? medios.filter((x) => x !== m) : [...medios, m] });
  const setDay = (d: string) => save({ ...prefs, day: d === today() ? null : d });
  // null = todos (así también entran los medios nuevos que se carguen después).
  const setAll = (all: boolean) => save({ ...prefs, medios: all ? null : [] });

  return { medios, day, toggleMedio, setDay, setAll };
};
