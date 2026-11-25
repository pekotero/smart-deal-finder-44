import { describe, it, expect } from "vitest";
import { activePromos, bestPromoForChain, bestPromoForStore, chainOk, dateOk, shoppingDate, type BankPromo } from "@/lib/promos";

const promo = (over: Partial<BankPromo>): BankPromo => ({
  id: Math.random().toString(36),
  medio: "Galicia",
  cadena: "Carrefour",
  aplica_a: [],
  dias: [],
  descuento: 10,
  tipo: "reintegro",
  tope: null,
  tope_periodo: null,
  minimo_compra: null,
  requisitos: null,
  online: null,
  vigencia_desde: null,
  vigencia_hasta: null,
  fuente: null,
  confianza: "alta",
  ...over,
});

// Domingo 22/11/2026
const NOW = new Date(2026, 10, 22, 12);

describe("chainOk", () => {
  it("DIA no matchea Diarco", () => {
    expect(chainOk(promo({ cadena: "DIA" }), "Diarco Rosario")).toBe(false);
    expect(chainOk(promo({ cadena: "DIA" }), "Supermercado DIA Pellegrini")).toBe(true);
  });

  it("respeta los formatos de aplica_a", () => {
    const p = promo({ aplica_a: ["Hipermercado Carrefour", "Carrefour Market", "Carrefour Express"] });
    expect(chainOk(p, "Carrefour Market Oroño")).toBe(true);
    expect(chainOk(p, "Carrefour Maxi Circunvalación")).toBe(false);
  });

  it("Todas vale para cualquier tienda", () => {
    expect(chainOk(promo({ cadena: "Todas" }), "La Gallega")).toBe(true);
  });

  it("ignora acentos y mayúsculas", () => {
    expect(chainOk(promo({ cadena: "Changomás" }), "CHANGOMAS Funes")).toBe(true);
  });
});

describe("vigencia", () => {
  it("calcula el próximo día elegido", () => {
    expect(shoppingDate("domingo", NOW)).toBe("2026-11-22");
    expect(shoppingDate("miércoles", NOW)).toBe("2026-11-25");
  });

  it("descarta promos vencidas para ese día", () => {
    const p = promo({ vigencia_desde: "2026-11-18", vigencia_hasta: "2026-11-25" });
    expect(dateOk(p, "miércoles", NOW)).toBe(true);
    expect(dateOk(p, "jueves", NOW)).toBe(false);
  });
});

describe("activePromos", () => {
  const promos = [
    promo({ medio: "Galicia", dias: ["miércoles"] }),
    promo({ medio: "Santander", dias: ["miércoles"] }),
    promo({ medio: "Galicia", dias: ["jueves"] }),
    promo({ medio: "Galicia", tipo: "cuotas sin interés", descuento: 0 }),
  ];

  it("filtra por medio de pago y día, y deja afuera las cuotas", () => {
    const r = activePromos(promos, { medios: ["Galicia"], day: "miércoles", now: NOW });
    expect(r).toHaveLength(1);
    expect(r[0].medio).toBe("Galicia");
  });
});

describe("bestPromoForStore", () => {
  const filters = { medios: ["Galicia", "Mercado Pago"], day: "domingo", now: NOW };

  it("elige la que más ahorra respetando el tope", () => {
    const promos = [
      promo({ medio: "Galicia", descuento: 30, tope: 5000 }),
      promo({ medio: "Mercado Pago", descuento: 15 }),
    ];
    const r = bestPromoForStore(promos, "Carrefour Market", filters, 100000);
    expect(r?.promo.medio).toBe("Mercado Pago");
    expect(r?.save).toBe(15000);
  });

  it("sin total elige el mayor porcentaje y saltea las sólo online", () => {
    const promos = [
      promo({ medio: "Galicia", descuento: 30, online: true }),
      promo({ medio: "Mercado Pago", descuento: 15 }),
    ];
    expect(bestPromoForStore(promos, "Carrefour Market", filters)?.promo.descuento).toBe(15);
  });

  it("a igual descuento prefiere la promo propia de la cadena", () => {
    const promos = [
      promo({ medio: "Galicia", cadena: "Todas", descuento: 20 }),
      promo({ medio: "Mercado Pago", cadena: "Carrefour", descuento: 20 }),
    ];
    expect(bestPromoForStore(promos, "Carrefour Market", filters)?.promo.medio).toBe("Mercado Pago");
  });

  it("avisa cuánto falta para la compra mínima", () => {
    const promos = [promo({ minimo_compra: 20000 })];
    const r = bestPromoForStore(promos, "Carrefour", filters, 15000);
    expect(r?.missing).toBe(5000);
    expect(r?.save).toBe(0);
  });
});

describe("bestPromoForChain", () => {
  const py = promo({ medio: "PedidosYa (saldo en la app)", cadena: "PedidosYa Market", dias: ["martes"], descuento: 30 });
  const carrefour = promo({ cadena: "Carrefour", dias: ["martes"], descuento: 20 });
  const todas = promo({ cadena: "Todas", dias: ["martes"], descuento: 15 });
  const all = [py, carrefour, todas];
  const f = { medios: ["Galicia", "PedidosYa (saldo en la app)"], day: "martes", now: NOW };

  it("PedidosYa Market toma sólo su promo", () => {
    expect(bestPromoForChain(all, "PedidosYa Market", f, 1000)?.promo).toBe(py);
  });

  it("Carrefour en PedidosYa no toma la promo del Carrefour ni la del Market", () => {
    expect(bestPromoForChain(all, "Carrefour (PedidosYa)", f, 1000)).toBeNull();
  });

  it("el Carrefour de siempre no toma la de PedidosYa", () => {
    expect(bestPromoForChain(all, "Carrefour", f, 1000)?.promo).toBe(carrefour);
    expect(bestPromoForChain(all, "Coto", f, 1000)?.promo).toBe(todas);
  });
});
