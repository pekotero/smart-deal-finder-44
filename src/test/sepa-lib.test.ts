import { describe, expect, it } from "vitest";
import { chainOf } from "@/lib/chains";
import { BANNERS, cleanDescription, decodeCsv, guessCategory, nearestBranches, normEan, parseCsv, pickDescription, titleCase } from "../../scraper/sepa-lib";

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
