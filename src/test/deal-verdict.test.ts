import { describe, expect, it } from "vitest";
import { dealVerdict, type HistoryPoint } from "@/lib/history";

const pts = (prices: [string, number][], chain = "Coto"): HistoryPoint[] => prices.map(([date, price]) => ({ chain, date, price }));
const month = pts([
  ["2026-10-20", 1000],
  ["2026-10-27", 1000],
  ["2026-11-03", 1050],
  ["2026-11-10", 1000],
  ["2026-11-17", 1000],
]);

describe("¿la oferta es real?", () => {
  it("descuento que es el precio de siempre", () => {
    const v = dealVerdict([...month, ...pts([["2026-11-25", 1000]])], ["Coto"], 1000, true);
    expect(v).toMatchObject({ kind: "fake", usual: 1000, days: 36 });
  });

  it("el más bajo del período", () => {
    expect(dealVerdict([...month, ...pts([["2026-11-25", 900]])], ["Coto"], 900, true)?.kind).toBe("lowest");
  });

  it("arriba y abajo de lo habitual", () => {
    const withLow = [...month, ...pts([["2026-10-21", 800], ["2026-10-22", 1100]], "Día")];
    expect(dealVerdict([...withLow, ...pts([["2026-11-25", 940]])], ["Coto", "Día"], 940, false)).toMatchObject({ kind: "below" });
    expect(dealVerdict([...month, ...pts([["2026-11-25", 1200]])], ["Coto"], 1200, false)).toMatchObject({ kind: "above", pct: 20 });
    expect(dealVerdict([...month, ...pts([["2026-11-25", 1010]])], ["Coto"], 1010, false)?.kind).toBe("usual");
  });

  it("con pocos días no opina", () => {
    expect(dealVerdict(pts([["2026-11-23", 1000], ["2026-11-25", 1000]]), ["Coto"], 1000, true)).toBeNull();
  });
});
