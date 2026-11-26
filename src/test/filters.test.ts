import { describe, expect, it } from "vitest";
import { activeFilterCount, applyPriceFilters, excludedWords, searchWithExclusions } from "@/lib/filters";

const list = [
  { id: "a", bestPrice: 500, prices: [{ price: 500 }] },
  { id: "b", bestPrice: 1500, prices: [{ price: 1500, originalPrice: 2000 }] },
  { id: "c", bestPrice: 3000, prices: [{ price: 3000, originalPrice: 2500 }] },
];

describe("filtros", () => {
  it("rango de precio y sólo con descuento", () => {
    expect(applyPriceFilters(list, { min: 1000 }).map((p) => p.id)).toEqual(["b", "c"]);
    expect(applyPriceFilters(list, { max: 1500 }).map((p) => p.id)).toEqual(["a", "b"]);
    expect(applyPriceFilters(list, { onlyDiscount: true }).map((p) => p.id)).toEqual(["b"]);
    expect(applyPriceFilters(list, {})).toHaveLength(3);
  });

  it("excluir palabras", () => {
    expect(excludedWords(" dulce, -polvo  ")).toEqual(["dulce", "polvo"]);
    expect(searchWithExclusions("leche ", "dulce polvo")).toBe("leche -dulce -polvo");
    expect(searchWithExclusions("", "dulce")).toBe("-dulce");
    expect(searchWithExclusions("leche", "")).toBe("leche");
  });

  it("cuenta filtros activos", () => {
    expect(activeFilterCount({ min: 100, onlyDiscount: true, exclude: "x" })).toBe(3);
    expect(activeFilterCount({ exclude: "  " })).toBe(0);
  });
});
