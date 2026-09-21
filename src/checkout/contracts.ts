import { date, exact, record, uuid } from "../customer/contracts";

export const MAX_CART_LINES = 100;
export const MAX_LINE_QUANTITY = 1_000_000_000;

export type QuoteLine = {
  outletProductId: string;
  productId: string;
  skuCode: string;
  productNameSnapshot: string;
  uomCodeSnapshot: string;
  uomNameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
};

type RuleReference = { ruleId: string; version: number };

export type CheckoutQuote = {
  quoteId: string;
  quoteToken: string;
  currency: "MYR";
  items: QuoteLine[];
  itemsSubtotalMinor: number;
  discountAmountMinor: number;
  netItemsTotalMinor: number;
  routeDistanceMeters: number;
  distanceKm: number;
  routeDurationSeconds: number;
  distanceProvider: string;
  deliveryBandId: string;
  deliverySlaMinutes: number;
  preparationTargetMinutes: number;
  minimumTravelSlaMinutes: number;
  operationalAllowanceMinutes: number;
  roundingIntervalMinutes: number;
  googleEstimatedTravelMinutes: number;
  committedTravelSlaMinutes: number;
  estimatedTotalOrderMinutes: number;
  baseDeliveryFeeMinor: number;
  deliveryDiscountMinor: number;
  finalDeliveryChargeMinor: number;
  processingFeeBasisMinor: number;
  processingFee: {
    enabled: boolean;
    feeType: "PERCENTAGE" | "FIXED";
    rate: string | null;
    fixedAmountMinor: number | null;
  };
  processingFeeMinor: number;
  grandTotalMinor: number;
  ruleReferences: {
    scheduling: RuleReference;
    deliveryPricing: RuleReference;
    deliveryTiming: RuleReference;
    freeDelivery: RuleReference | null;
    processingFee: RuleReference;
    refundPolicy: RuleReference;
  };
  deliveryPromotion: Record<string, unknown> | null;
  savtVoucher: Record<string, unknown> | null;
  quoteIssuedAt: string;
  quoteExpiresAt: string;
  outletId?: string;
  customerAddressId?: string;
  addressRowVersion?: number;
};

const fail = (): never => {
  throw new Error("Invalid checkout quote response.");
};
const integer = (
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const money = (value: unknown): value is number => integer(value);
const nullableMoney = (value: unknown): value is number | null =>
  value === null || money(value);

const rule = (value: unknown): RuleReference => {
  if (
    !record(value) ||
    !exact(value, ["ruleId", "version"]) ||
    !uuid(value.ruleId) ||
    !integer(value.version, 1)
  )
    return fail();
  return { ruleId: value.ruleId, version: value.version };
};

const line = (value: unknown): QuoteLine => {
  const keys = [
    "outletProductId",
    "productId",
    "skuCode",
    "productNameSnapshot",
    "uomCodeSnapshot",
    "uomNameSnapshot",
    "quantity",
    "unitPriceMinor",
    "lineSubtotalMinor",
  ];
  if (
    !record(value) ||
    !exact(value, keys) ||
    !uuid(value.outletProductId) ||
    !uuid(value.productId) ||
    !text(value.skuCode, 120) ||
    !text(value.productNameSnapshot, 200) ||
    !text(value.uomCodeSnapshot, 40) ||
    !text(value.uomNameSnapshot, 120) ||
    !integer(value.quantity, 1, MAX_LINE_QUANTITY) ||
    !money(value.unitPriceMinor) ||
    !money(value.lineSubtotalMinor) ||
    value.unitPriceMinor * value.quantity !== value.lineSubtotalMinor
  )
    return fail();
  return { ...value } as QuoteLine;
};

const processing = (value: unknown): CheckoutQuote["processingFee"] => {
  if (
    !record(value) ||
    !exact(value, ["enabled", "feeType", "rate", "fixedAmountMinor"]) ||
    typeof value.enabled !== "boolean" ||
    !["PERCENTAGE", "FIXED"].includes(String(value.feeType)) ||
    !(
      value.rate === null ||
      (typeof value.rate === "string" && /^\d{1,9}\.\d{4}$/.test(value.rate))
    ) ||
    !nullableMoney(value.fixedAmountMinor)
  )
    return fail();
  if (
    value.enabled &&
    ((value.feeType === "PERCENTAGE" &&
      (value.rate === null || value.fixedAmountMinor !== null)) ||
      (value.feeType === "FIXED" &&
        (value.fixedAmountMinor === null || value.rate !== null)))
  )
    return fail();
  return { ...value } as CheckoutQuote["processingFee"];
};

const promotion = (value: unknown): Record<string, unknown> | null => {
  if (value === null) return null;
  const keys = [
    "versionId",
    "familyId",
    "version",
    "name",
    "scope",
    "qualifyingMerchandiseSubtotalMinor",
    "matchedTierId",
    "matchedMinimumSpendMinor",
    "benefitType",
    "configuredBenefitMinor",
    "baseDeliveryFeeMinor",
    "actualDiscountMinor",
    "finalDeliveryFeeMinor",
    "companyFundedSubsidyMinor",
  ];
  if (
    !record(value) ||
    !exact(value, keys) ||
    !uuid(value.versionId) ||
    !uuid(value.familyId) ||
    !integer(value.version, 1) ||
    !text(value.name, 200) ||
    !["ALL_OUTLETS", "SELECTED_OUTLETS"].includes(String(value.scope)) ||
    !uuid(value.matchedTierId) ||
    !["FIXED_DELIVERY_DISCOUNT", "FREE_DELIVERY"].includes(
      String(value.benefitType),
    ) ||
    !nullableMoney(value.configuredBenefitMinor) ||
    ![
      "qualifyingMerchandiseSubtotalMinor",
      "matchedMinimumSpendMinor",
      "baseDeliveryFeeMinor",
      "actualDiscountMinor",
      "finalDeliveryFeeMinor",
      "companyFundedSubsidyMinor",
    ].every((key) => money(value[key]))
  )
    return fail();
  return { ...value };
};

const voucher = (value: unknown): Record<string, unknown> | null => {
  if (value === null) return null;
  if (
    !record(value) ||
    !exact(value, [
      "entitlementId",
      "displayName",
      "voucherType",
      "discountMinor",
      "reservationExpiresAt",
    ]) ||
    !text(value.entitlementId, 200) ||
    !text(value.displayName, 200) ||
    !["ITEM_DISCOUNT", "ORDER_MERCHANDISE_DISCOUNT"].includes(
      String(value.voucherType),
    ) ||
    !money(value.discountMinor) ||
    !date(value.reservationExpiresAt)
  )
    return fail();
  return { ...value };
};

export function parseQuote(value: unknown): CheckoutQuote {
  const baseKeys = [
    "quoteId",
    "quoteToken",
    "currency",
    "items",
    "itemsSubtotalMinor",
    "discountAmountMinor",
    "netItemsTotalMinor",
    "routeDistanceMeters",
    "distanceKm",
    "routeDurationSeconds",
    "distanceProvider",
    "deliveryBandId",
    "deliverySlaMinutes",
    "preparationTargetMinutes",
    "minimumTravelSlaMinutes",
    "operationalAllowanceMinutes",
    "roundingIntervalMinutes",
    "googleEstimatedTravelMinutes",
    "committedTravelSlaMinutes",
    "estimatedTotalOrderMinutes",
    "baseDeliveryFeeMinor",
    "deliveryDiscountMinor",
    "finalDeliveryChargeMinor",
    "processingFeeBasisMinor",
    "processingFee",
    "processingFeeMinor",
    "grandTotalMinor",
    "ruleReferences",
    "deliveryPromotion",
    "savtVoucher",
    "quoteIssuedAt",
    "quoteExpiresAt",
  ];
  const evidenceKeys = ["outletId", "customerAddressId", "addressRowVersion"];
  if (!record(value) || !exact(value, ["data"]) || !record(value.data))
    return fail();
  const data = value.data;
  const evidenceCount = evidenceKeys.filter((key) =>
    Object.hasOwn(data, key),
  ).length;
  if (
    !exact(data, [...baseKeys, ...(evidenceCount ? evidenceKeys : [])]) ||
    (evidenceCount !== 0 && evidenceCount !== 3)
  )
    return fail();
  if (
    !Array.isArray(data.items) ||
    data.items.length < 1 ||
    data.items.length > MAX_CART_LINES
  )
    return fail();
  const items = data.items.map(line);
  if (new Set(items.map((item) => item.outletProductId)).size !== items.length)
    return fail();
  const references = data.ruleReferences;
  if (
    !record(references) ||
    !exact(references, [
      "scheduling",
      "deliveryPricing",
      "deliveryTiming",
      "freeDelivery",
      "processingFee",
      "refundPolicy",
    ])
  )
    return fail();
  const processingFee = processing(data.processingFee);
  if (
    !uuid(data.quoteId) ||
    !text(data.quoteToken, 4096) ||
    data.currency !== "MYR" ||
    !money(data.itemsSubtotalMinor) ||
    !money(data.discountAmountMinor) ||
    !money(data.netItemsTotalMinor) ||
    !integer(data.routeDistanceMeters) ||
    typeof data.distanceKm !== "number" ||
    !Number.isFinite(data.distanceKm) ||
    data.distanceKm < 0 ||
    !integer(data.routeDurationSeconds, 0, 2_147_483_647) ||
    !text(data.distanceProvider, 120) ||
    !uuid(data.deliveryBandId) ||
    ![
      "deliverySlaMinutes",
      "preparationTargetMinutes",
      "minimumTravelSlaMinutes",
      "operationalAllowanceMinutes",
      "roundingIntervalMinutes",
      "googleEstimatedTravelMinutes",
      "committedTravelSlaMinutes",
      "estimatedTotalOrderMinutes",
    ].every((key) => integer(data[key])) ||
    !money(data.baseDeliveryFeeMinor) ||
    !money(data.deliveryDiscountMinor) ||
    !money(data.finalDeliveryChargeMinor) ||
    !money(data.processingFeeBasisMinor) ||
    !money(data.processingFeeMinor) ||
    !money(data.grandTotalMinor) ||
    !date(data.quoteIssuedAt) ||
    !date(data.quoteExpiresAt) ||
    Date.parse(data.quoteExpiresAt) <= Date.parse(data.quoteIssuedAt) ||
    items.reduce((sum, item) => sum + item.lineSubtotalMinor, 0) !==
      data.itemsSubtotalMinor ||
    data.discountAmountMinor > data.itemsSubtotalMinor ||
    data.itemsSubtotalMinor - data.discountAmountMinor !==
      data.netItemsTotalMinor ||
    data.deliveryDiscountMinor > data.baseDeliveryFeeMinor ||
    data.baseDeliveryFeeMinor - data.deliveryDiscountMinor !==
      data.finalDeliveryChargeMinor ||
    data.netItemsTotalMinor + data.finalDeliveryChargeMinor !==
      data.processingFeeBasisMinor ||
    data.processingFeeBasisMinor + data.processingFeeMinor !==
      data.grandTotalMinor
  )
    return fail();
  if (
    evidenceCount === 3 &&
    (!uuid(data.outletId) ||
      !uuid(data.customerAddressId) ||
      !integer(data.addressRowVersion, 1))
  )
    return fail();
  return {
    ...data,
    items,
    processingFee,
    ruleReferences: {
      scheduling: rule(references.scheduling),
      deliveryPricing: rule(references.deliveryPricing),
      deliveryTiming: rule(references.deliveryTiming),
      freeDelivery:
        references.freeDelivery === null ? null : rule(references.freeDelivery),
      processingFee: rule(references.processingFee),
      refundPolicy: rule(references.refundPolicy),
    },
    deliveryPromotion: promotion(data.deliveryPromotion),
    savtVoucher: voucher(data.savtVoucher),
  } as CheckoutQuote;
}
