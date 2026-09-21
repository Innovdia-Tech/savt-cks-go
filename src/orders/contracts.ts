export const customerOrderStages = [
  "ORDER_RECEIVED",
  "PICK_AND_PACK",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
] as const;
export type CustomerOrderStage = (typeof customerOrderStages)[number];

export type OrderTracking = {
  currentState: string | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
};
export type OrderListItem = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  customerStage: CustomerOrderStage;
  paymentStatus: "PAID";
  outletId: string;
  outletName: string;
  currency: "MYR";
  grandTotalMinor: number;
  deliveryType: "NOW" | "SCHEDULED";
  tracking: OrderTracking;
  receiptAvailable: boolean;
  canCancel: boolean;
};
export type OrderPage = {
  data: OrderListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};
export type OrderItem = {
  orderItemId: string;
  skuCode: string;
  productName: string;
  uomCode: string;
  uomName: string;
  orderedQuantity: number;
  fulfilledQuantity: number | null;
  unavailableQuantity: number | null;
  unitPriceMinor: number;
  discountMinor: number;
  lineTotalMinor: number;
};
export type OrderDetail = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  customerStage: CustomerOrderStage;
  paymentStatus: "PAID";
  cancellationKind: "CUSTOMER_REQUEST" | "OPERATIONAL_FAILURE" | null;
  operationalFailure: {
    scenario: "ZERO_FULFILMENT" | "PERMANENT_RETURN";
    reasonCode: string;
    occurredAt: string;
  } | null;
  outletId: string;
  outletName: string;
  canCancel: boolean;
  items: OrderItem[];
  fulfilment: { fulfilmentConfirmed: boolean; confirmedAt: string | null };
  money: {
    itemsSubtotalMinor: number;
    discountAmountMinor: number;
    netItemsTotalMinor: number;
    finalDeliveryChargeMinor: number;
    processingFeeMinor: number;
    grandTotalMinor: number;
    currency: "MYR";
  };
  destination: {
    recipientName: string | null;
    recipientPhoneE164: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postcode: string;
    instructions: string | null;
  };
  delivery: { deliveryType: "NOW" | "SCHEDULED" } & OrderTracking;
  milestones: Record<
    | "paymentConfirmedAt"
    | "acceptedAt"
    | "pickingStartedAt"
    | "pickingConfirmedAt"
    | "pandaConfirmedAt"
    | "packingCompletedAt"
    | "cancelledAt"
    | "deliveredAt"
    | "completedAt",
    string | null
  >;
  refund: {
    refundRequired: boolean;
    requiredAmountMinor: number;
    totalRequiredAmountMinor: number;
    requirementStatus: "REQUIRED" | null;
  };
  receipt: {
    receiptAvailable: boolean;
    receiptReference: string | null;
    issuedAt: string | null;
    metadataPath: string | null;
    downloadPath: string | null;
  };
};
export type CancellationResult = {
  orderId: string;
  customerStage: "CANCELLED";
  paymentStatus: "PAID";
  cancelledAt: string;
  canCancel: false;
  refundRequired: true;
  requiredAmountMinor: number;
  requirementStatus: "REQUIRED";
  currency: "MYR";
};

type RecordValue = Record<string, unknown>;
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = (): never => {
  throw new Error("Invalid customer order response.");
};
const record = (value: unknown): RecordValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return invalid();
  return value as RecordValue;
};
const exact = (value: unknown, keys: readonly string[]): RecordValue => {
  const item = record(value);
  if (
    Object.keys(item).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(item, key))
  )
    return invalid();
  return item;
};
const text = (value: unknown, max = 240): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const nullableText = (value: unknown, max = 240): value is string | null =>
  value === null || text(value, max);
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
const nullableDate = (value: unknown): value is string | null =>
  value === null || date(value);
const natural = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;
const positive = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1;
const uuid = (value: unknown): value is string =>
  typeof value === "string" && uuidV4.test(value);

const trackingKeys = [
  "currentState",
  "assignedAt",
  "pickedUpAt",
  "deliveredAt",
] as const;
const validateTracking = (value: unknown): void => {
  const item = exact(value, trackingKeys);
  if (
    !nullableText(item.currentState, 120) ||
    !nullableDate(item.assignedAt) ||
    !nullableDate(item.pickedUpAt) ||
    !nullableDate(item.deliveredAt)
  )
    invalid();
};
const summaryKeys = [
  "orderId",
  "orderNumber",
  "createdAt",
  "updatedAt",
  "customerStage",
  "paymentStatus",
  "outletId",
  "outletName",
  "currency",
  "grandTotalMinor",
  "deliveryType",
  "tracking",
  "receiptAvailable",
  "canCancel",
] as const;
const validateSummary = (value: unknown): void => {
  const item = exact(value, summaryKeys);
  if (
    !uuid(item.orderId) ||
    !text(item.orderNumber, 120) ||
    !date(item.createdAt) ||
    !date(item.updatedAt) ||
    !customerOrderStages.includes(item.customerStage as CustomerOrderStage) ||
    item.paymentStatus !== "PAID" ||
    !uuid(item.outletId) ||
    !text(item.outletName, 200) ||
    item.currency !== "MYR" ||
    !natural(item.grandTotalMinor) ||
    (item.deliveryType !== "NOW" && item.deliveryType !== "SCHEDULED") ||
    typeof item.receiptAvailable !== "boolean" ||
    typeof item.canCancel !== "boolean"
  )
    invalid();
  validateTracking(item.tracking);
};

export const parseOrderList = (value: unknown): OrderPage => {
  const envelope = exact(value, ["data", "meta"]);
  if (!Array.isArray(envelope.data) || envelope.data.length > 100)
    return invalid();
  envelope.data.forEach(validateSummary);
  const meta = exact(envelope.meta, [
    "page",
    "pageSize",
    "total",
    "totalPages",
  ]);
  if (
    !positive(meta.page) ||
    !positive(meta.pageSize) ||
    Number(meta.pageSize) > 100 ||
    !natural(meta.total) ||
    !natural(meta.totalPages)
  )
    return invalid();
  return value as OrderPage;
};

const validateItems = (value: unknown): void => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100)
    return invalid();
  for (const raw of value) {
    const item = exact(raw, [
      "orderItemId",
      "skuCode",
      "productName",
      "uomCode",
      "uomName",
      "orderedQuantity",
      "fulfilledQuantity",
      "unavailableQuantity",
      "unitPriceMinor",
      "discountMinor",
      "lineTotalMinor",
    ]);
    if (
      !uuid(item.orderItemId) ||
      !text(item.skuCode, 120) ||
      !text(item.productName, 240) ||
      !text(item.uomCode, 80) ||
      !text(item.uomName, 120) ||
      !positive(item.orderedQuantity) ||
      !(item.fulfilledQuantity === null || natural(item.fulfilledQuantity)) ||
      !(
        item.unavailableQuantity === null || natural(item.unavailableQuantity)
      ) ||
      !natural(item.unitPriceMinor) ||
      !natural(item.discountMinor) ||
      !natural(item.lineTotalMinor)
    )
      invalid();
  }
};
const milestonesKeys = [
  "paymentConfirmedAt",
  "acceptedAt",
  "pickingStartedAt",
  "pickingConfirmedAt",
  "pandaConfirmedAt",
  "packingCompletedAt",
  "cancelledAt",
  "deliveredAt",
  "completedAt",
] as const;

export const parseOrderDetail = (value: unknown): OrderDetail => {
  const envelope = exact(value, ["data"]);
  const item = exact(envelope.data, [
    "orderId",
    "orderNumber",
    "createdAt",
    "updatedAt",
    "customerStage",
    "paymentStatus",
    "cancellationKind",
    "operationalFailure",
    "outletId",
    "outletName",
    "canCancel",
    "items",
    "fulfilment",
    "money",
    "destination",
    "delivery",
    "milestones",
    "refund",
    "receipt",
  ]);
  if (
    !uuid(item.orderId) ||
    !text(item.orderNumber, 120) ||
    !date(item.createdAt) ||
    !date(item.updatedAt) ||
    !customerOrderStages.includes(item.customerStage as CustomerOrderStage) ||
    item.paymentStatus !== "PAID" ||
    ![null, "CUSTOMER_REQUEST", "OPERATIONAL_FAILURE"].includes(
      item.cancellationKind as never,
    ) ||
    !uuid(item.outletId) ||
    !text(item.outletName, 200) ||
    typeof item.canCancel !== "boolean"
  )
    invalid();
  if (item.operationalFailure !== null) {
    const failure = exact(item.operationalFailure, [
      "scenario",
      "reasonCode",
      "occurredAt",
    ]);
    if (
      (failure.scenario !== "ZERO_FULFILMENT" &&
        failure.scenario !== "PERMANENT_RETURN") ||
      !text(failure.reasonCode, 120) ||
      !date(failure.occurredAt)
    )
      invalid();
  }
  validateItems(item.items);
  const fulfilment = exact(item.fulfilment, [
    "fulfilmentConfirmed",
    "confirmedAt",
  ]);
  if (
    typeof fulfilment.fulfilmentConfirmed !== "boolean" ||
    !nullableDate(fulfilment.confirmedAt)
  )
    invalid();
  const money = exact(item.money, [
    "itemsSubtotalMinor",
    "discountAmountMinor",
    "netItemsTotalMinor",
    "finalDeliveryChargeMinor",
    "processingFeeMinor",
    "grandTotalMinor",
    "currency",
  ]);
  if (
    ![
      money.itemsSubtotalMinor,
      money.discountAmountMinor,
      money.netItemsTotalMinor,
      money.finalDeliveryChargeMinor,
      money.processingFeeMinor,
      money.grandTotalMinor,
    ].every(natural) ||
    money.currency !== "MYR"
  )
    invalid();
  const destination = exact(item.destination, [
    "recipientName",
    "recipientPhoneE164",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postcode",
    "instructions",
  ]);
  if (
    !nullableText(destination.recipientName, 200) ||
    !nullableText(destination.recipientPhoneE164, 40) ||
    !text(destination.addressLine1, 240) ||
    !nullableText(destination.addressLine2, 240) ||
    !text(destination.city, 120) ||
    !text(destination.state, 120) ||
    !text(destination.postcode, 24) ||
    !nullableText(destination.instructions, 500)
  )
    invalid();
  const delivery = exact(item.delivery, ["deliveryType", ...trackingKeys]);
  if (delivery.deliveryType !== "NOW" && delivery.deliveryType !== "SCHEDULED")
    invalid();
  validateTracking({
    currentState: delivery.currentState,
    assignedAt: delivery.assignedAt,
    pickedUpAt: delivery.pickedUpAt,
    deliveredAt: delivery.deliveredAt,
  });
  const milestones = exact(item.milestones, milestonesKeys);
  if (!milestonesKeys.every((key) => nullableDate(milestones[key]))) invalid();
  const refund = exact(item.refund, [
    "refundRequired",
    "requiredAmountMinor",
    "totalRequiredAmountMinor",
    "requirementStatus",
  ]);
  if (
    typeof refund.refundRequired !== "boolean" ||
    !natural(refund.requiredAmountMinor) ||
    !natural(refund.totalRequiredAmountMinor) ||
    (refund.requirementStatus !== null &&
      refund.requirementStatus !== "REQUIRED")
  )
    invalid();
  const receipt = exact(item.receipt, [
    "receiptAvailable",
    "receiptReference",
    "issuedAt",
    "metadataPath",
    "downloadPath",
  ]);
  if (typeof receipt.receiptAvailable !== "boolean") invalid();
  const metadataPath = `/api/v1/orders/${item.orderId}/receipt`;
  const downloadPath = `${metadataPath}/download`;
  if (receipt.receiptAvailable) {
    if (
      !text(receipt.receiptReference, 120) ||
      !date(receipt.issuedAt) ||
      receipt.metadataPath !== metadataPath ||
      receipt.downloadPath !== downloadPath
    )
      invalid();
  } else if (
    receipt.receiptReference !== null ||
    receipt.issuedAt !== null ||
    receipt.metadataPath !== null ||
    receipt.downloadPath !== null
  )
    invalid();
  return item as OrderDetail;
};

export const parseCancellation = (value: unknown): CancellationResult => {
  const envelope = exact(value, ["data"]);
  const item = exact(envelope.data, [
    "orderId",
    "customerStage",
    "paymentStatus",
    "cancelledAt",
    "canCancel",
    "refundRequired",
    "requiredAmountMinor",
    "requirementStatus",
    "currency",
  ]);
  if (
    !uuid(item.orderId) ||
    item.customerStage !== "CANCELLED" ||
    item.paymentStatus !== "PAID" ||
    !date(item.cancelledAt) ||
    item.canCancel !== false ||
    item.refundRequired !== true ||
    !natural(item.requiredAmountMinor) ||
    item.requirementStatus !== "REQUIRED" ||
    item.currency !== "MYR"
  )
    invalid();
  return item as CancellationResult;
};
