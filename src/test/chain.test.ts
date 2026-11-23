import { describe, it, expect } from "vitest";
import { chainOf } from "@/hooks/useProducts";

describe("chainOf", () => {
  it("reconoce las sucursales de las cadenas", () => {
    expect(chainOf("Disco (Avenida San Martín 1127, Cosquín)")).toBe("Disco");
    expect(chainOf("Supermercado Disco (Friuli 1845)")).toBe("Disco");
    expect(chainOf("Vea (Lamadrid 300, Dorrego)")).toBe("Vea");
    expect(chainOf("Supermercado VEA (San Martín 1400, Gualeguaychú)")).toBe("Vea");
    expect(chainOf("Dia (Don Bosco 53, Paraná)")).toBe("Día");
    expect(chainOf("Dia Market (Crámer 4355, Ciudad Autónoma de Buenos Aires)")).toBe("Día");
    expect(chainOf("ChangoMâs (Colectora Santiago Marzo Este 1550, Santa Rosa)")).toBe("ChangoMás");
    expect(chainOf("Walmart ChangoMAS")).toBe("ChangoMás");
    expect(chainOf("Hiper ChangoMâs")).toBe("ChangoMás");
    expect(chainOf("Changomas (Avenida Domingo Faustino Sarmiento, Goya)")).toBe("ChangoMás");
    expect(chainOf("Jumbo Fisherton")).toBe("Jumbo");
  });

  it("no confunde comercios con nombres parecidos", () => {
    for (const name of ["Diarco (Gregoria Pérez 248, Concordia)", "Buen Día (Carlos Calvo 866)", "Vea Dia (Bartolomé Mitre 969, Salta)", "El Chango", "Chango", "Super Vea", "Diamante"]) {
      expect(chainOf(name)).toBe(name);
    }
  });
});
