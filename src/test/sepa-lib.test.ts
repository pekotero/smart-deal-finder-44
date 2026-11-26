import { describe, expect, it } from "vitest";
import { chainOf } from "@/lib/chains";
import { BANNERS, cleanDescription, decodeCsv, guessCategory, nearestBranches, normEan, parseCsv, parseSepaPrice, pickDescription, titleCase } from "../../scraper/sepa-lib";

describe("datos SEPA", () => {
  it("normaliza EAN y descarta códigos internos", () => {
    expect(normEan("0000040084107")).toBe("40084107");
    expect(normEan("7791720048313")).toBe("7791720048313");
    expect(normEan("12345")).toBeNull();
    expect(normEan("ABC123456789")).toBeNull();
  });

  it("lee CSV en UTF-8 y en Latin-1", () => {
    const latin = Buffer.from("id|calle\n1|Perú 916\n", "latin1");
    expect(parseCsv(decodeCsv(latin))).toEqual([{ id: "1", calle: "Perú 916" }]);
    const utf = Buffer.from("﻿id|calle\n1|Perú 916\n2|de más|x\n", "utf8");
    expect(parseCsv(decodeCsv(utf))).toEqual([{ id: "1", calle: "Perú 916" }]);
  });

  it("arma nombres legibles", () => {
    expect(titleCase("LECHE ENTERA LA SERENISIMA X 1 LT")).toBe("Leche Entera la Serenisima x 1 lt");
    expect(cleanDescription("12", "HUEVO DE CHOCOLATE KINDER CON SORPRESA CJA 20 GRM")).toBe("Huevo de Chocolate Kinder con Sorpresa 20 grm");
    expect(cleanDescription("9", "Desmaquillante NIVEA Bifásico de ojos PVC-125-ml.")).toBe("Desmaquillante NIVEA Bifásico de ojos x 125 ml");
    expect(cleanDescription("9", "Galletitas opera x 55 gr. PAQ-55-gr.")).toBe("Galletitas opera x 55 gr");
  });

  it("prefiere la descripción de Coto a la cortada de Día", () => {
    expect(pickDescription({ "15": "HUEVO DE CHOCOLATE", "12": "HUEVO DE CHOCOLATE KINDER CON SORPRESA CJA 20 GRM" })).toBe(
      "Huevo de Chocolate Kinder con Sorpresa 20 grm",
    );
    expect(pickDescription({ "15": "ALFAJOR TRIPLE MOUSS" })).toBe("Alfajor Triple Mouss");
  });

  it("adivina la categoría sólo cuando la reconoce", () => {
    expect(guessCategory("Leche Entera la Serenisima x 1 lt")).toBe("Lácteos");
    expect(guessCategory("Detergente Magistral Limón 500 ml")).toBe("Limpieza");
    expect(guessCategory("Desodorante Rexona Men 150 ml")).toBe("Higiene");
    expect(guessCategory("Cerveza Quilmes 1 lt")).toBe("Bebidas");
    expect(guessCategory("Televisor Smart 50 pulgadas")).toBeNull();
  });

  it("elige la sucursal más cercana de cada grupo dentro del radio", () => {
    const zone = { name: "Z", lat: -34.49, lng: -58.62, radiusKm: 15 };
    const b = (key: string, group: string, lat: number) => ({ key, banner: key.split("-").slice(0, 2).join("-"), group, lat, lng: -58.62, address: "" });
    const chosen = nearestBranches(
      [b("11-2-1", "ChangoMás", -34.53), b("11-5-7", "ChangoMás", -34.51), b("12-1-3", "Coto", -34.6), b("12-1-4", "Coto", -34.9)],
      [zone],
    );
    expect(chosen.map((c) => c.key).sort()).toEqual(["11-5-7", "12-1-3"]);
  });

  it("los nombres de las banderas dan la cadena de la app", () => {
    const chains = new Set(Object.values(BANNERS).map((n) => chainOf(`${n} (Calle 1, Tigre)`)));
    expect([...chains].sort()).toEqual(["Carrefour", "ChangoMás", "Coto", "Cooperativa Obrera", "Disco", "Día", "Jumbo", "La Anónima", "Vea"].sort());
  });
});

describe("promos SEPA", () => {
  it("rebaja directa de promo1", () => {
    expect(parseSepaPrice("2190.00", "1890.00", "Promo A valida desde el 25/11/2026 hasta 01/12/2026", "", "")).toEqual({ price: 1890, original: 2190 });
  });

  it("promos por cantidad de Día", () => {
    const v = (l: string, p: string, list = "5990.00") => parseSepaPrice(list, "", "", p, `35% de descuento. ${l} - Vigencia: Desde el 25/11/2026 hasta el 30/11/2026`);
    expect(v("2DO AL 70% SIDRAS Y", "3893.50")).toEqual({ price: 5990, promo: { text: "2° al 70%", unitPrice: 3893.5, minQty: 2 } });
    expect(v("3X2 CLIGHT", "3993.33")?.promo).toEqual({ text: "3x2", unitPrice: 3993.33, minQty: 3 });
    expect(v("2X$1000 ALFJ TURIMAR", "500.00", "720.00")?.promo).toEqual({ text: "2 x $1.000", unitPrice: 500, minQty: 2 });
  });

  it("rebaja directa en promo2 y casos raros", () => {
    expect(parseSepaPrice("4020.00", "", "", "3015.00", "25% de descuento. 25% ALA ROPA - Vigencia: Desde el 25/11/2026 hasta el 30/11/2026")).toEqual({
      price: 3015,
      original: 4020,
    });
    expect(parseSepaPrice("1000", "", "", "", "")).toEqual({ price: 1000 });
    expect(parseSepaPrice("0", "", "", "", "")).toBeNull();
    // Promo absurda (menos del 20% del precio): se ignora.
    expect(parseSepaPrice("1000", "10", "Promo A", "", "")).toEqual({ price: 1000 });
  });
});
