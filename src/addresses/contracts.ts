import {
  record,
  exact,
  uuid,
  date,
  unwrap,
  invalid,
} from "../customer/contracts";
export type AddressInput = {
  label: string;
  recipientName: string;
  recipientPhoneE164?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postcode?: string | null;
  countryCode: "MY";
  deliveryInstructions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};
export type Address = Required<AddressInput> & {
  id: string;
  status: "ACTIVE" | "INACTIVE";
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
};
export type FieldErrors = Record<string, string>;
export const fieldLimits = {
  label: 100,
  recipientName: 200,
  recipientPhoneE164: 32,
  addressLine1: 200,
  addressLine2: 200,
  city: 100,
  state: 100,
  postcode: 20,
  deliveryInstructions: 500,
} as const;
const requiredFields = [
  "label",
  "recipientName",
  "addressLine1",
  "city",
  "state",
];
export const validateAddressInput = (value: unknown): FieldErrors => {
  if (!record(value)) return { form: "Enter an address." };
  const errors: FieldErrors = {};
  for (const [key, max] of Object.entries(fieldLimits)) {
    const v = value[key];
    if (requiredFields.includes(key) && (typeof v !== "string" || !v.trim()))
      errors[key] = "This field is required.";
    else if (
      v !== undefined &&
      v !== null &&
      (typeof v !== "string" || v.trim().length > max)
    )
      errors[key] = `Use at most ${max} characters.`;
  }
  if (
    value.recipientPhoneE164 &&
    (typeof value.recipientPhoneE164 !== "string" ||
      !/^\+[1-9]\d{7,14}$/.test(value.recipientPhoneE164.trim()))
  )
    errors.recipientPhoneE164 =
      "Use international format, starting with + and country code.";
  if (value.countryCode !== "MY")
    errors.countryCode = "Saved addresses must be in Malaysia.";
  for (const [key, max] of [
    ["latitude", 90],
    ["longitude", 180],
  ] as const) {
    const v = value[key];
    if (
      v !== undefined &&
      v !== null &&
      (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > max)
    )
      errors[key] = `Enter a number between -${max} and ${max}.`;
  }
  if (value.isDefault !== undefined && typeof value.isDefault !== "boolean")
    errors.isDefault = "Choose whether this is the default address.";
  return errors;
};
const keys = [
  "id",
  ...Object.keys(fieldLimits),
  "countryCode",
  "latitude",
  "longitude",
  "isDefault",
  "status",
  "rowVersion",
  "createdAt",
  "updatedAt",
];
export const parseAddress = (value: unknown): Address => {
  const d = unwrap(value);
  if (
    !record(d) ||
    !exact(d, keys) ||
    !uuid(d.id) ||
    Object.keys(validateAddressInput(d)).length ||
    typeof d.status !== "string" ||
    !["ACTIVE", "INACTIVE"].includes(d.status) ||
    typeof d.isDefault !== "boolean" ||
    !Number.isSafeInteger(d.rowVersion) ||
    Number(d.rowVersion) < 1 ||
    !date(d.createdAt) ||
    !date(d.updatedAt) ||
    (d.status === "INACTIVE" && d.isDefault)
  )
    return invalid();
  for (const key of [
    "recipientPhoneE164",
    "addressLine2",
    "postcode",
    "deliveryInstructions",
    "latitude",
    "longitude",
  ])
    if (d[key] === undefined) return invalid();
  return { ...d } as Address;
};
export const parseAddresses = (value: unknown): Address[] => {
  const d = unwrap(value);
  if (!Array.isArray(d)) return invalid();
  const list = d.map((v) => parseAddress({ data: v }));
  if (
    new Set(list.map((a) => a.id)).size !== list.length ||
    list.filter((a) => a.isDefault).length > 1
  )
    return invalid();
  return list;
};
