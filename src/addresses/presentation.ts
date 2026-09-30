import type { Address } from "./contracts";

type AddressLocation = Pick<
  Address,
  "label" | "addressLine1" | "addressLine2" | "city" | "state" | "postcode"
>;

export const addressLocationText = (address: AddressLocation) =>
  [
    address.addressLine1,
    address.addressLine2,
    address.postcode,
    address.city,
    address.state,
  ]
    .filter(Boolean)
    .join(", ");

export function editAddressName(address: Address, active: Address[]) {
  const detail = addressLocationText(address);
  const base = `Edit ${[address.label?.trim(), detail].filter(Boolean).join(", ")}`;
  const matching = active.filter(
    (candidate) =>
      [candidate.label?.trim(), addressLocationText(candidate)]
        .filter(Boolean)
        .join(", ") ===
      [address.label?.trim(), detail].filter(Boolean).join(", "),
  );
  return matching.length > 1
    ? `${base}, address ${matching.findIndex((candidate) => candidate.id === address.id) + 1} of ${matching.length}`
    : base;
}
