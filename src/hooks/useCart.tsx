import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Carrito guardado en el navegador y, si iniciaste sesión, también en tu cuenta (así lo ves en el
// celu y en la compu). Si la cuenta no responde, sigue funcionando sólo con el navegador.
export interface CartItem {
  id: string;
  name: string;
  image: string;
  qty: number;
  // Precio por cadena cuando se agregó (las cadenas cercanas al usuario).
  prices: { store: string; price: number }[];
  // Cadenas de PedidosYa donde el usuario marcó que ya lo agregó.
  added?: string[];
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  has: (id: string) => boolean;
  add: (item: Omit<CartItem, "qty" | "added">) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  toggleAdded: (id: string, chain: string) => void;
  clear: () => void;
}

const KEY = "carrito-v1";
const CartContext = createContext<CartContextValue | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.id === "string") : [];
  } catch {
    return [];
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const snapshot = (i: CartItem) => JSON.stringify([i.qty, i.prices, i.added ?? [], i.name, i.image]);

// Junta el carrito del navegador con el de la cuenta: si un producto está en los dos, queda la
// cantidad mayor y las marcas de "ya lo agregué" de ambos.
export function mergeCarts(local: CartItem[], remote: CartItem[]): CartItem[] {
  const out = new Map(remote.map((i) => [i.id, i]));
  for (const l of local) {
    const r = out.get(l.id);
    if (!r) out.set(l.id, l);
    else out.set(l.id, { ...r, qty: Math.max(r.qty, l.qty), added: [...new Set([...(r.added ?? []), ...(l.added ?? [])])] });
  }
  return [...out.values()];
}

type CartRow = { product_id: string; name: string; image: string | null; qty: number; prices: unknown; added: string[] };
const fromRow = (r: CartRow): CartItem => ({
  id: r.product_id,
  name: r.name,
  image: r.image || "",
  qty: r.qty,
  prices: Array.isArray(r.prices) ? (r.prices as CartItem["prices"]) : [],
  added: r.added ?? [],
});

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(load);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Último estado guardado en la cuenta (id -> snapshot); null mientras no se cargó.
  const synced = useRef<Map<string, string> | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // Sin almacenamiento (modo privado): el carrito dura mientras la página esté abierta.
    }
  }, [items]);

  // Al iniciar sesión: baja el carrito de la cuenta y lo junta con el del navegador.
  useEffect(() => {
    synced.current = null;
    setRemoteReady(false);
    if (!userId) return;
    let stale = false;
    (async () => {
      const { data, error } = await supabase.from("cart_items").select("*").eq("user_id", userId);
      if (stale) return;
      if (error) {
        console.warn("El carrito no se pudo leer de la cuenta; queda sólo en este navegador:", error.message);
        return;
      }
      const remote = (data as CartRow[]).map(fromRow);
      synced.current = new Map(remote.map((i) => [i.id, snapshot(i)]));
      setItems((local) => mergeCarts(local, remote));
      setRemoteReady(true);
    })();
    return () => {
      stale = true;
    };
  }, [userId]);

  // Cada cambio se guarda en la cuenta: sólo los productos que cambiaron y los que se sacaron.
  useEffect(() => {
    const prev = synced.current;
    if (!userId || !remoteReady || !prev) return;
    const valid = items.filter((i) => UUID_RE.test(i.id));
    const now = new Map(valid.map((i) => [i.id, snapshot(i)]));
    const changed = valid.filter((i) => prev.get(i.id) !== now.get(i.id));
    const gone = [...prev.keys()].filter((id) => !now.has(id));
    synced.current = now;
    const warn = ({ error }: { error: { message: string } | null }) => {
      if (error) console.warn("No se pudo guardar el carrito en la cuenta:", error.message);
    };
    if (changed.length) {
      supabase
        .from("cart_items")
        .upsert(
          changed.map((i) => ({
            user_id: userId,
            product_id: i.id,
            name: i.name,
            image: i.image || null,
            qty: i.qty,
            prices: i.prices,
            added: i.added ?? [],
            updated_at: new Date().toISOString(),
          })),
        )
        .then(warn);
    }
    if (gone.length) supabase.from("cart_items").delete().eq("user_id", userId).in("product_id", gone).then(warn);
  }, [items, userId, remoteReady]);

  const add = useCallback((item: Omit<CartItem, "qty" | "added">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      // Si ya estaba, suma uno y actualiza los precios.
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, ...item, qty: i.qty + 1 } : i));
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
  }, []);

  const toggleAdded = useCallback((id: string, chain: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const added = new Set(i.added ?? []);
        if (added.has(chain)) added.delete(chain);
        else added.add(chain);
        return { ...i, added: [...added] };
      }),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      has: (id) => items.some((i) => i.id === id),
      add,
      remove,
      setQty,
      toggleAdded,
      clear,
    }),
    [items, add, remove, setQty, toggleAdded, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart tiene que usarse dentro de CartProvider");
  return ctx;
};

// Total por cadena: suma los productos que esa cadena tiene y cuenta los que le faltan.
export function totalsByChain(items: CartItem[]) {
  const chains = new Map<string, { total: number; found: number }>();
  for (const item of items) {
    for (const p of item.prices) {
      const t = chains.get(p.store) ?? { total: 0, found: 0 };
      t.total += p.price * item.qty;
      t.found += 1;
      chains.set(p.store, t);
    }
  }
  return [...chains.entries()]
    .map(([store, t]) => ({ store, total: t.total, missing: items.length - t.found }))
    .sort((a, b) => a.missing - b.missing || a.total - b.total);
}
