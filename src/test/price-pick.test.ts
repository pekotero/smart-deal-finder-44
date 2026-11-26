import { describe, expect, it } from "vitest";
import { pickPrices, priceSources } from "@/lib/price-pick";

const nearby = [
  { id: "coto-cerca", name: "Coto (Av. Siempreviva 1)", distance: 1 },
  { id: "coto-sepa", name: "Coto (Uruguay 4691, La Horqueta)", distance: 4.5, price_source: "sepa" },
  { id: "dia-cerca", name: "Dia (Calle 2)", distance: 0.4 },
  { id: "pya-dia", name: "PedidosYa · Dia (Don Torcuato)", distance: 2, price_source: "online" },
];
const online = [
  { id: "coto-online", name: "Coto (Avenida Santa Fe 3760)", price_source: "online" },
  { id: "dia-online", name: "Dia (Las Heras, Lomas del Mirador)", price_source: "online" },
  { id: "jumbo-online", name: "Jumbo (Las Magnolias 698)", price_source: "online" },
  { id: "pya-dia", name: "PedidosYa · Dia (Don Torcuato)", price_source: "online" },
];

describe("priceSources", () => {
  const sources = priceSources(nearby, online);

  it("el precio online se muestra en la sucursal más cercana de la cadena", () => {
    expect(sources.get("coto-online")).toMatchObject({ chain: "Coto", rank: 1, branch: { id: "coto-cerca" } });
    expect(sources.get("dia-online")).toMatchObject({ chain: "Día", rank: 1, branch: { id: "dia-cerca" } });
  });

  it("no usa cadenas sin sucursal cerca", () => {
    expect(sources.has("jumbo-online")).toBe(false);
  });

  it("las sucursales cercanas son fuentes locales, salvo las tiendas online", () => {
    expect(sources.get("coto-sepa")).toMatchObject({ chain: "Coto", rank: 0 });
    expect(sources.get("pya-dia")).toMatchObject({ chain: "Día (PedidosYa)", rank: 1 });
  });
});

describe("pickPrices", () => {
  const sources = priceSources(nearby, online);

  it("el precio de la sucursal le gana al online de la misma cadena", () => {
    const picked = pickPrices(
      [
        { id: "a", store_id: "coto-online", price: 1000, last_updated: "2026-11-25" },
        { id: "b", store_id: "coto-sepa", price: 1100, last_updated: "2026-11-24" },
      ],
      sources,
    );
    expect(picked).toHaveLength(1);
    expect(picked[0]).toMatchObject({ id: "b", price: 1100, store: "Coto", store_id: "coto-sepa", source_store_id: "coto-sepa", local: true, distance: 4.5 });
  });

  it("sin precio local usa el online, en la sucursal más cercana", () => {
    const [p] = pickPrices([{ id: "a", store_id: "coto-online", price: "1000" }], sources);
    expect(p).toMatchObject({ price: 1000, store_id: "coto-cerca", source_store_id: "coto-online", local: false, distance: 1 });
  });

  it("un precio por cadena, ordenados de menor a mayor, sin tiendas fuera de las fuentes", () => {
    const picked = pickPrices(
      [
        { id: "a", store_id: "coto-online", price: 1000 },
        { id: "b", store_id: "dia-online", price: 900 },
        { id: "c", store_id: "pya-dia", price: 950 },
        { id: "d", store_id: "jumbo-online", price: 100 },
        { id: "e", store_id: "coto-sepa", price: 0 },
      ],
      sources,
    );
    expect(picked.map((p) => [p.store, p.price])).toEqual([
      ["Día", 900],
      ["Día (PedidosYa)", 950],
      ["Coto", 1000],
    ]);
    expect(picked[1].online).toBe(true);
  });

  it("descarta precios anteriores absurdos", () => {
    const [p] = pickPrices([{ id: "a", store_id: "coto-online", price: 3550, original_price: 355000 }], sources);
    expect(p.originalPrice).toBeUndefined();
  });
});
