import { describe, expect, it } from "vitest";
import { alertMessage, alertMet, alertThreshold, bestForAlert, describeRule, shouldNotify } from "@/lib/alerts";

describe("alertas de precio", () => {
  it("cada regla tiene su precio de corte", () => {
    expect(alertThreshold({ kind: "any", base_price: 1000 })).toBe(999);
    expect(alertThreshold({ kind: "target", base_price: 1000, target_price: 800 })).toBe(800);
    expect(alertThreshold({ kind: "percent", base_price: 1000, percent: 15 })).toBe(850);
  });

  it("se cumple al llegar al precio o menos", () => {
    const a = { kind: "target" as const, base_price: 1000, target_price: 800 };
    expect(alertMet(a, 801)).toBe(false);
    expect(alertMet(a, 800)).toBe(true);
    expect(alertMet({ kind: "any", base_price: 1000 }, 1000)).toBe(false);
    expect(alertMet({ kind: "any", base_price: 1000 }, 990)).toBe(true);
    expect(alertMet({ kind: "any", base_price: 1000 }, null)).toBe(false);
  });

  it("vuelve a avisar sólo si baja más que el último aviso", () => {
    const a = { kind: "percent" as const, base_price: 1000, percent: 10, notified_price: 880 };
    expect(shouldNotify(a, 880)).toBe(false);
    expect(shouldNotify(a, 870)).toBe(true);
    expect(shouldNotify({ ...a, notified_price: null }, 900)).toBe(true);
  });

  it("mira sólo las tiendas de la alerta", () => {
    const rows = [
      { store_id: "a", price: 900, store_name: "Coto (X)" },
      { store_id: "b", price: 700, store_name: "Jumbo (Y)" },
      { store_id: "c", price: 0 },
    ];
    expect(bestForAlert(rows, ["a", "c"])).toEqual({ price: 900, storeId: "a", storeName: "Coto (X)" });
    expect(bestForAlert(rows, null)?.price).toBe(700);
    expect(bestForAlert(rows, ["z"])).toBeNull();
  });

  it("textos", () => {
    expect(describeRule({ kind: "percent", base_price: 2000, percent: 10 })).toBe("Cuando baje 10% (a $1.800)");
    expect(alertMessage("Leche", { kind: "any", base_price: 2000 }, 1500, "Coto").body).toBe("Está a $1.500 en Coto (25% menos que $2.000).");
  });
});
