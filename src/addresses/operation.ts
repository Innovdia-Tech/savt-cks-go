import {
  type Address,
  type AddressInput,
  validateAddressInput,
} from "./contracts";
import { uuid } from "../customer/contracts";
export type AddressAction =
  "create" | "edit" | "default" | "deactivate" | "reactivate";
export type AddressOperation = Readonly<{
  kind: AddressAction;
  path: string;
  method: "POST" | "PATCH";
  body: string;
  key?: string;
  version?: number;
}>;
export const createOperation = (
  kind: AddressAction,
  address?: Address,
  input?: AddressInput,
): AddressOperation => {
  if (
    kind !== "create" &&
    (!address ||
      !uuid(address.id) ||
      !Number.isSafeInteger(address.rowVersion) ||
      address.rowVersion < 1)
  )
    throw new Error("Reload the saved address.");
  if (
    (kind === "create" || kind === "edit") &&
    Object.keys(validateAddressInput(input)).length
  )
    throw new Error("Check the address fields.");
  const body: Record<string, unknown> = {};
  if (input && (kind === "create" || kind === "edit")) {
    for (const k of [
      "label",
      "recipientName",
      "recipientPhoneE164",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "postcode",
      "countryCode",
      "deliveryInstructions",
      "latitude",
      "longitude",
      ...(kind === "create" ? ["isDefault"] : []),
    ]) {
      const v = input[k as keyof AddressInput];
      if (v !== undefined)
        body[k] = typeof v === "string" ? v.trim() || null : v;
    }
  }
  return Object.freeze({
    kind,
    path:
      "/api/v1/customer/me/addresses" +
      (kind === "create"
        ? ""
        : "/" + address!.id + (kind === "edit" ? "" : "/" + kind)),
    method: kind === "edit" ? "PATCH" : "POST",
    body: JSON.stringify(body),
    ...(kind !== "edit" ? { key: crypto.randomUUID() } : {}),
    ...(kind !== "create" ? { version: address!.rowVersion } : {}),
  });
};
