import { describe, it, expect } from "vitest";
import {
  parseAssignment,
  parseCategories,
  parseProducts,
  parseDetail,
} from "./contracts";
const id = "11111111-1111-4111-8111-111111111111";
const time = "2026-09-19T00:00:00.000Z";
const expiry = "2026-09-19T00:05:00.000Z";
const outlet = {
  id,
  displayReference: "DEMO",
  displayName: "Demo outlet",
  status: "ACTIVE",
  operatingState: "ONLINE",
  availability: "AVAILABLE",
};
const assignment = {
  data: {
    assignmentContextId: "A".repeat(43),
    customerAddressId: id,
    addressRowVersion: 1,
    outlet,
    resolvedAt: time,
    expiresAt: expiry,
  },
  meta: { asOf: time },
};
const meta = {
  page: 1,
  pageSize: 24,
  total: 1,
  hasNextPage: false,
  asOf: time,
  outlet,
  assignmentContextExpiresAt: expiry,
};
const product = {
  productId: id,
  outletProductId: id,
  name: "Rice",
  imageUrl: null,
  category: { id, name: "Pantry" },
  subcategory: null,
  brand: null,
  uom: { code: "BAG", name: "Bag" },
  packSize: "1 kg",
  sellingPriceMinor: 1234,
  currency: "MYR",
  availability: "AVAILABLE",
};
describe("closed R2 projections", () => {
  it("accepts complete assignment and catalogue shapes", () => {
    expect(parseAssignment(assignment).data.addressRowVersion).toBe(1);
    expect(
      parseCategories({ data: [{ id, name: "Pantry" }], meta }).data[0].name,
    ).toBe("Pantry");
    expect(
      parseProducts({ data: [product], meta }).data[0].sellingPriceMinor,
    ).toBe(1234);
    expect(
      parseDetail({
        data: { ...product, description: "Plain text", storageType: "AMBIENT" },
        meta: { outlet, asOf: time, assignmentContextExpiresAt: expiry },
      }).data.description,
    ).toBe("Plain text");
  });
  it.each([
    { addressRowVersion: "1" },
    { addressRowVersion: 0 },
    { assignmentContextId: "A".repeat(42) + "B" },
    { assignmentContextId: "token" },
    { expiresAt: time },
    { expiresAt: "2026-09-19T00:05:01.000Z" },
    { customerAddressId: "address" },
    { distance: 5 },
    { outlet: { ...outlet, eta: "soon" } },
  ])("rejects malformed or overbroad assignments %j", (patch) =>
    expect(() =>
      parseAssignment({
        ...assignment,
        data: { ...assignment.data, ...patch },
      }),
    ).toThrow(),
  );
  it.each([
    { sellingPriceMinor: 1.25 },
    { sellingPriceMinor: "1234" },
    { sellingPriceMinor: -1 },
    { sellingPriceMinor: 1000000000000 },
    { availability: "LOW_STOCK" },
    { imageUrl: "http://images.example/image.jpg" },
    { imageUrl: "https://user:pass@images.example/a" },
    { currency: "USD" },
    { sku: "private" },
    { category: { id, name: "Pantry", status: "ACTIVE" } },
    { name: "x".repeat(201) },
  ])("rejects unsafe product projection %j", (patch) =>
    expect(() =>
      parseProducts({ data: [{ ...product, ...patch }], meta }),
    ).toThrow(),
  );
  it("rejects extra envelope/meta fields and inconsistent pagination", () => {
    expect(() =>
      parseAssignment({ ...assignment, requestId: "extra" }),
    ).toThrow();
    expect(() =>
      parseProducts({
        data: [product],
        meta: { ...meta, customerAddressId: id },
      }),
    ).toThrow();
    expect(() =>
      parseProducts({ data: [product], meta: { ...meta, hasNextPage: true } }),
    ).toThrow();
    expect(() =>
      parseProducts({ data: [product, product], meta: { ...meta, total: 2 } }),
    ).toThrow();
    expect(() =>
      parseCategories({
        data: [{ id, name: "Pantry" }],
        meta: { ...meta, pageSize: 101 },
      }),
    ).toThrow();
  });
});

it("rejects impossible available products under an unavailable outlet", () => {
  expect(() =>
    parseProducts({
      data: [product],
      meta: { ...meta, outlet: { ...outlet, availability: "UNAVAILABLE" } },
    }),
  ).toThrow();
  expect(() =>
    parseDetail({
      data: { ...product, description: null, storageType: "AMBIENT" },
      meta: {
        outlet: { ...outlet, availability: "UNAVAILABLE" },
        asOf: time,
        assignmentContextExpiresAt: expiry,
      },
    }),
  ).toThrow();
});
it.each([
  { description: 4 },
  { description: "x".repeat(4001) },
  { storageType: "HOT" },
  { privateNotes: "not public" },
])("rejects invalid detail-only fields %j", (patch) => {
  expect(() =>
    parseDetail({
      data: { ...product, description: null, storageType: "AMBIENT", ...patch },
      meta: { outlet, asOf: time, assignmentContextExpiresAt: expiry },
    }),
  ).toThrow();
});
it.each([
  { id: "wrong", name: "A" },
  { id, name: 3 },
  { id, name: "" },
  { id, name: "A", private: true },
])("rejects invalid category %j", (item) =>
  expect(() => parseCategories({ data: [item], meta })).toThrow(),
);
