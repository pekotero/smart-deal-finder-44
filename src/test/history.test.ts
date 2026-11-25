import { describe, it, expect } from "vitest";
import { bestPriceChange, chainColor, historyRows } from "@/lib/history";

const pts = [
  { chain: "Coto", date: "2026-11-22", price: 100 },
  { chain: "Día", date: "2026-11-22", price: 110 },
  { chain: "Día", date: "2026-11-24", price: 80 },
];

describe("historial", () => {
  it("repite el último precio conocido de cada cadena", () => {
    expect(historyRows(pts, ["Coto", "Día"])).toEqual([
      { date: "2026-11-22", Coto: 100, "Día": 110 },
      { date: "2026-11-24", Coto: 100, "Día": 80 },
    ]);
  });

  it("calcula cuánto cambió el mejor precio", () => {
    expect(bestPriceChange(pts, ["Coto", "Día"])).toEqual({ from: 100, to: 80, pct: -20 });
    expect(bestPriceChange(pts.slice(0, 2), ["Coto", "Día"])).toBeNull();
  });

  it("el color sigue a la cadena, no a su posición", () => {
    expect(chainColor("Día", ["Día"])).toBe(chainColor("Día", ["Coto", "Jumbo", "Día"]));
    expect(chainColor("Carrefour (PedidosYa)", ["Coto", "Carrefour (PedidosYa)"])).not.toBe(chainColor("Coto", ["Coto"]));
  });
});
