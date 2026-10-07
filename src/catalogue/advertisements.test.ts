import { describe, expect, it } from "vitest";
import { parseAdvertisements } from "./advertisements";

const id = "11111111-1111-4111-8111-111111111111";
const asset = "22222222-2222-4222-8222-222222222222";
export const advertisement = {
  id,
  placement: "HOME_HERO",
  displayOrder: 1,
  altText: "Fresh groceries from CKS",
  imageUrl: `/api/v1/advertisement-media/${id}/${asset}`,
  startsAt: null,
  endsAt: null,
  action: { type: "NONE" },
};

describe("customer advertisement boundary", () => {
  it.each([
    { type: "NONE" },
    { type: "PRODUCT", productId: id },
    { type: "CATEGORY", categoryId: id },
    { type: "EXTERNAL_URL", url: "https://cks.example/promotion" },
  ])("accepts the safe $type projection", (action) => {
    expect(
      parseAdvertisements({ data: [{ ...advertisement, action }] }),
    ).toEqual([{ ...advertisement, action }]);
  });
  it("accepts zero advertisements and rejects private fields", () => {
    expect(parseAdvertisements({ data: [] })).toEqual([]);
    expect(() =>
      parseAdvertisements({
        data: [{ ...advertisement, internalName: "secret" }],
      }),
    ).toThrow();
  });
  it.each([
    { type: "NONE", url: "https://cks.example" },
    { type: "PRODUCT", productId: id, categoryId: id },
    { type: "CATEGORY", categoryId: "invalid" },
    { type: "EXTERNAL_URL", url: "http://cks.example" },
    { type: "EXTERNAL_URL", url: "https://user:password@cks.example" },
    { type: "EXTERNAL_URL", url: "javascript:alert(1)" },
    { type: "EXTERNAL_URL", url: "https://cks.example/" + "x".repeat(2048) },
  ])("rejects malformed or unsafe actions", (action) => {
    expect(() =>
      parseAdvertisements({ data: [{ ...advertisement, action }] }),
    ).toThrow();
  });
  it("rejects image paths belonging to another ad and duplicate records", () => {
    expect(() =>
      parseAdvertisements({
        data: [
          {
            ...advertisement,
            imageUrl: `/api/v1/advertisement-media/${asset}/${id}`,
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseAdvertisements({ data: [advertisement, advertisement] }),
    ).toThrow();
  });
});
