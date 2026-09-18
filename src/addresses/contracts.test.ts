import { describe, it, expect } from "vitest";
import { parseProfile } from "../customer/contracts";
import {
  parseAddress,
  parseAddresses,
  validateAddressInput,
} from "./contracts";
export const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  savtMemberId: null,
  nameSnapshot: "Synthetic member",
  phoneE164Snapshot: null,
  membershipTier: "GOLD",
  savtMemberStatus: "ACTIVE",
  accountStatus: "ACTIVE",
  savtSyncStatus: "SYNCED",
  savtSyncedAt: "2026-09-01T00:00:00.000Z",
};
export const address = {
  id: "22222222-2222-4222-8222-222222222222",
  label: "Demo home",
  recipientName: "Synthetic recipient",
  recipientPhoneE164: null,
  addressLine1: "1 Example Street",
  addressLine2: null,
  city: "Demo City",
  state: "Sabah",
  postcode: null,
  countryCode: "MY",
  deliveryInstructions: null,
  latitude: null,
  longitude: null,
  isDefault: true,
  status: "ACTIVE",
  rowVersion: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
describe("profile contract", () => {
  it("accepts the current public DTO including nullable snapshots", () =>
    expect(parseProfile({ data: profile })).toEqual(profile));
  it.each([
    { secret: "unexpected" },
    { membershipTier: "VIP" },
    { savtSyncStatus: "OK" },
    { accountStatus: null },
    { savtSyncedAt: "yesterday" },
    { id: "bad" },
  ])("rejects expanded or malformed fields %j", (change) =>
    expect(() => parseProfile({ data: { ...profile, ...change } })).toThrow(),
  );
  it("rejects expanded envelopes", () =>
    expect(() =>
      parseProfile({ data: profile, token: "unexpected" }),
    ).toThrow());
});
describe("address contract", () => {
  it("accepts a saved address and an empty list", () => {
    expect(parseAddress({ data: address })).toEqual(address);
    expect(parseAddresses({ data: [] })).toEqual([]);
  });
  it.each([
    { customerId: "unexpected" },
    { rowVersion: "1" },
    { rowVersion: 0 },
    { status: "DELETED" },
    { countryCode: "SG" },
    { latitude: 91 },
    { longitude: -181 },
    { recipientPhoneE164: "012345" },
    { updatedAt: "2026-02-30T00:00:00.000Z" },
    { label: "" },
  ])("rejects malformed or expanded address %j", (change) =>
    expect(() => parseAddress({ data: { ...address, ...change } })).toThrow(),
  );
  it("rejects missing nullable fields and duplicate address IDs", () => {
    const { postcode, ...missing } = address;
    expect(() => parseAddress({ data: missing })).toThrow();
    expect(() => parseAddresses({ data: [address, address] })).toThrow();
  });
  it("validates the form against DTO limits without requiring optional phone or postcode", () => {
    expect(
      validateAddressInput({
        label: "Home",
        recipientName: "Example",
        addressLine1: "1 Example",
        city: "Demo",
        state: "Sabah",
        countryCode: "MY",
      }),
    ).toEqual({});
    expect(
      validateAddressInput({
        label: " ",
        recipientPhoneE164: "bad",
        latitude: 91,
      }),
    ).toMatchObject({
      label: expect.any(String),
      recipientPhoneE164: expect.any(String),
      latitude: expect.any(String),
    });
  });
});

it("rejects array-valued enums rather than coercing them to strings", () => {
  for (const key of [
    "membershipTier",
    "savtMemberStatus",
    "accountStatus",
    "savtSyncStatus",
  ] as const)
    expect(() =>
      parseProfile({ data: { ...profile, [key]: [profile[key]] } }),
    ).toThrow();
  expect(() =>
    parseAddress({ data: { ...address, status: ["ACTIVE"] } }),
  ).toThrow();
});
