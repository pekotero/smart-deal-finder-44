import { describe, it, expect } from "vitest";
import { totalsByChain, type CartItem } from "@/hooks/useCart";
import { pedidosYaSearchUrl, searchTerm } from "@/lib/pedidosya";

describe("searchTerm", () => {
  it("saca el tamaño y las palabras vacías", () => {
    expect(searchTerm("Gaseosa Sprite Lima Limón 2.25 L")).toBe("Gaseosa Sprite Lima Limón");
    expect(searchTerm("Aceite de Girasol Cañuelas 900 Ml")).toBe("Aceite Girasol Cañuelas");
    expect(searchTerm("Yogur Bebible Ser Frutilla x 900 g")).toBe("Yogur Bebible Ser Frutilla");
    expect(searchTerm("Leche Entera La Serenísima 3% 1 L")).toBe("Leche Entera Serenísima");
  });

  it("arma el link de búsqueda sólo para tiendas de PedidosYa", () => {
    expect(pedidosYaSearchUrl("Día (PedidosYa)", "Gaseosa Sprite 2.25 L")).toMatch(/dia-don-torcuato.*-menu\?search=Gaseosa%20Sprite$/);
    expect(pedidosYaSearchUrl("Coto", "Gaseosa Sprite 2.25 L")).toBeNull();
  });
});

describe("totalsByChain", () => {
  it("suma por cadena y cuenta lo que falta", () => {
    const items: CartItem[] = [
      { id: "a", name: "A", image: "", qty: 2, prices: [{ store: "Coto", price: 100 }, { store: "Día (PedidosYa)", price: 90 }] },
      { id: "b", name: "B", image: "", qty: 1, prices: [{ store: "Coto", price: 50 }] },
    ];
    expect(totalsByChain(items)).toEqual([
      { store: "Coto", total: 250, missing: 0 },
      { store: "Día (PedidosYa)", total: 180, missing: 1 },
    ]);
  });
});
