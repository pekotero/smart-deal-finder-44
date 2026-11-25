import { describe, it, expect } from "vitest";
import { suspiciousPrice } from "../../scraper/price-rules";

describe("suspiciousPrice", () => {
  it("acepta precios normales y cambios razonables", () => {
    expect(suspiciousPrice(4400, null, [])).toBeNull();
    expect(suspiciousPrice(5200, 4400, [4300, 4500])).toBeNull();
  });

  it("rechaza precios absurdos", () => {
    expect(suspiciousPrice(0.89, null, [])).toMatch(/\$0.89/);
    expect(suspiciousPrice(355000, 3550, [])).toMatch(/pasó de/);
    expect(suspiciousPrice(900, 3550, [])).toMatch(/pasó de/);
  });

  it("rechaza un precio muy lejos del de las otras cadenas", () => {
    expect(suspiciousPrice(1200, null, [4300, 4500, 4400])).toMatch(/otras cadenas/);
    expect(suspiciousPrice(1200, null, [4300])).toBeNull();
  });
});
