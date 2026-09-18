import type { Address } from "../addresses/contracts";
import type { Profile } from "./contracts";
const timestamp = "2026-09-01T00:00:00.000Z";
export const syntheticProfile: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  savtMemberId: null,
  nameSnapshot: "Synthetic member",
  phoneE164Snapshot: null,
  membershipTier: "GOLD",
  savtMemberStatus: "ACTIVE",
  accountStatus: "ACTIVE",
  savtSyncStatus: "SYNCED",
  savtSyncedAt: timestamp,
};
export const syntheticAddress: Address = {
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
  createdAt: timestamp,
  updatedAt: timestamp,
};
