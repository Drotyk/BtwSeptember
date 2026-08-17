import { describe, expect, it } from "vitest";

import { normalizePhone, validateCustomAnswer, validateName } from "../src/validators.js";

describe("validators", () => {
  it("normalizes Ukrainian phone numbers", () => {
    expect(normalizePhone("050 123 45 67")).toBe("+380501234567");
    expect(normalizePhone("+380 (50) 123-45-67")).toBe("+380501234567");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("validates a two-part Ukrainian name", () => {
    expect(validateName("  Петренко   Іван ")).toBe("Петренко Іван");
    expect(validateName("Прізвище Ім’я")).toBeNull();
    expect(validateName("Іван")).toBeNull();
    expect(validateName("Іван 123")).toBeNull();
  });

  it("normalizes custom answers and enforces length", () => {
    expect(validateCustomAnswer("  власна   відповідь ")).toBe("власна відповідь");
    expect(validateCustomAnswer("", 10)).toBeNull();
    expect(validateCustomAnswer("123456", 5)).toBeNull();
  });
});
