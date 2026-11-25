import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Carrito guardado en el navegador (no hace falta iniciar sesión).
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

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // Sin almacenamiento (modo privado): el carrito dura mientras la página esté abierta.
    }
  }, [items]);

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
