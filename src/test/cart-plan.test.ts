import { describe, it, expect } from "vitest";
import type { CartItem } from "@/hooks/useCart";
import { bestEverywhere, bestSingle, bestSplit, chainsIn, planFor } from "@/lib/cart-plan";

const item = (id: string, prices: Record<string, number>, qty = 1): CartItem => ({
  id,
  name: id,
  image: "",
  qty,
  prices: Object.entries(prices).map(([store, price]) => ({ store, price })),
});

const items = [
  item("leche", { Coto: 1000, Día: 900, Carrefour: 1100 }, 2),
  item("aceite", { Coto: 4000, Día: 4500, Carrefour: 3800 }),
  item("yerba", { Coto: 3000, Día: 2500 }),
];
const noPromo = () => null;

describe("planes de compra", () => {
  it("todo en un super: gana el que tiene todo y sale menos", () => {
    const p = bestSingle(items, chainsIn(items), noPromo)!;
    expect(p.parts.map((x) => x.chain)).toEqual(["Día"]);
    expect(p.final).toBe(1800 + 4500 + 2500);
    expect(p.missing).toEqual([]);
  });

  it("repartido: cada producto va donde está más barato", () => {
    const p = bestSplit(items, chainsIn(items), noPromo)!;
    expect(p.parts.map((x) => x.chain).sort()).toEqual(["Carrefour", "Día"]);
    expect(p.final).toBe(1800 + 3800 + 2500);
  });

  it("la promo se aplica sobre el subtotal de cada super, con tope", () => {
    const promo = (chain: string, subtotal: number) => (chain === "Coto" ? { save: Math.min(subtotal * 0.3, 1000) } : null);
    const p = planFor(items, ["Coto"], promo);
    expect(p.parts[0].subtotal).toBe(2000 + 4000 + 3000);
    expect(p.final).toBe(9000 - 1000);
  });

  it("cuenta lo que ninguna cadena del plan tiene", () => {
    const p = planFor(items, ["Carrefour"], noPromo);
    expect(p.missing.map((i) => i.id)).toEqual(["yerba"]);
  });
});

describe("máximo ahorro", () => {
  it("cada producto donde está más barato, sólo si usa más de dos supers", () => {
    const three = [...items, item("arroz", { Coto: 500, Día: 900, Carrefour: 950 })];
    const p = bestEverywhere(three, chainsIn(three), noPromo)!;
    expect(p.parts.map((x) => x.chain).sort()).toEqual(["Carrefour", "Coto", "Día"]);
    expect(p.final).toBe(1800 + 3800 + 2500 + 500);
    expect(bestEverywhere(items, chainsIn(items), noPromo)).toBeNull();
  });
});
