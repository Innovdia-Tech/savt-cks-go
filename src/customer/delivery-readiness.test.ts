import { describe, expect, it } from "vitest";
import { hasDeliveryCoordinates } from "./delivery-readiness";
import type { Address } from "../addresses/contracts";

const address = {
  id: "00000000-0000-4000-8000-000000000001",
  label: "Home",
  recipientName: "Test",
  recipientPhoneE164: null,
  addressLine1: "Lot 57",
  addressLine2: null,
  city: "Penampang",
  state: "Sabah",
  postcode: "89500",
  countryCode: "MY" as const,
  deliveryInstructions: null,
  latitude: 5.9,
  longitude: 116.1,
  isDefault: true,
  status: "ACTIVE" as const,
  rowVersion: 1,
  createdAt: "2026-09-29T00:00:00.000Z",
  updatedAt: "2026-09-29T00:00:00.000Z",
} satisfies Address;

describe("delivery readiness", () => {
  it("requires an active address with both finite coordinates", () => {
    expect(hasDeliveryCoordinates(address)).toBe(true);
    expect(hasDeliveryCoordinates({ ...address, latitude: null })).toBe(false);
    expect(hasDeliveryCoordinates({ ...address, longitude: null })).toBe(false);
    expect(hasDeliveryCoordinates({ ...address, status: "INACTIVE" })).toBe(
      false,
    );
  });
  it("rejects out-of-range and non-finite saved locations", () => {
    for (const latitude of [91, -91, Infinity, NaN])
      expect(hasDeliveryCoordinates({ ...address, latitude })).toBe(false);
    for (const longitude of [181, -181, Infinity, NaN])
      expect(hasDeliveryCoordinates({ ...address, longitude })).toBe(false);
    expect(
      hasDeliveryCoordinates({ ...address, latitude: 0, longitude: 0 }),
    ).toBe(true);
  });
});
