import { describe, expect, it } from "vitest";
import { addressFormFields } from "./AddressForm";

describe("AddressForm customer fields", () => {
  it("never exposes latitude or longitude as editable address fields", () => {
    expect(Object.keys(addressFormFields)).not.toContain("latitude");
    expect(Object.keys(addressFormFields)).not.toContain("longitude");
    expect(Object.values(addressFormFields).join(" ")).not.toMatch(
      /latitude|longitude|coordinates/i,
    );
  });
});
