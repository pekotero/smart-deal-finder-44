import { describe, it, expect } from "vitest";
import { compareSizeKeys, sizeFromName, sizeKey, sizeLabel } from "@/lib/size";

const key = (name: string) => sizeKey(sizeFromName(name));

describe("sizeFromName", () => {
  it("lee litros y mililitros en la misma unidad", () => {
    expect(key("Gaseosa Pepsi Cola 1.5lt")).toBe("1.5 lt");
    expect(key("Leche Protein La Serenisima 1L")).toBe("1 lt");
    expect(key("Gaseosa Pepsi  Botella 500mlx1")).toBe("0.5 lt");
    expect(key("Gaseosa Black Mango X 354 Cc Pepsi")).toBe("0.354 lt");
    expect(key("Aceite Girasol VICENTIN 900 Cmq")).toBe("0.9 lt");
    expect(key("Aceite de Girasol 1,5 Lts Legitimo")).toBe("1.5 lt");
  });

  it("lee gramos y kilos", () => {
    expect(key("Harina De Trigo CAÑUELAS 000 Paquete 1 Kg")).toBe("1 kg");
    expect(key("Jabón en pan Bulnez 150 grs")).toBe("0.15 kg");
    expect(key("Galletitas sandwich Traviata 108 g")).toBe("0.108 kg");
    expect(key("Harina 0000 Vitazinc Favorita Paq 1 Kgm")).toBe("1 kg");
  });

  it("prefiere el volumen a las unidades de un pack", () => {
    expect(key("Gaseosa Pepsi Pack X 6 Un 500 ml")).toBe("0.5 lt");
    expect(key("Gaseosa Pepsi Cola Pack X 24 Un.")).toBe("24 un");
  });

  it("productos por kilo", () => {
    expect(key("Queso Cremoso Doble Crema Horma x Kg La Paulina")).toBe("1 kg");
  });

  it("sin tamaño en el nombre", () => {
    expect(sizeFromName("Queso Cremoso Parmalat")).toBeNull();
    expect(key("Queso Cremoso Parmalat")).toBe("");
  });
});

describe("sizeLabel y orden", () => {
  it("muestra ml y g para menos de 1", () => {
    expect(sizeLabel("0.5 lt")).toBe("500 ml");
    expect(sizeLabel("0.108 kg")).toBe("108 g");
    expect(sizeLabel("1.5 lt")).toBe("1,5 lt");
    expect(sizeLabel("6 un")).toBe("6 unidades");
  });

  it("ordena por unidad y tamaño", () => {
    expect(["1 kg", "1.5 lt", "0.5 lt", "6 un"].sort(compareSizeKeys)).toEqual(["0.5 lt", "1.5 lt", "1 kg", "6 un"]);
  });
});
