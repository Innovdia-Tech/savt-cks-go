import { date, exact, record, uuid } from "../customer/contracts";
import { isLocalPaymentSimulatorCheckoutUrl } from "./local-simulator";

export type PaymentCreate = {
  checkoutReference: string;
  payment: {
    paymentIntentId: string;
    status: "PENDING" | "FAILED";
    checkoutUrl: string;
    expiresAt?: string;
  };
};

export type PaymentOrder = {
  orderId: string;
  orderNumber: string;
  status: string;
};

export type PaymentResult = {
  checkoutReference: string;
  status: "PENDING" | "FAILED" | "PAID_PROCESSING" | "PAID";
  order: PaymentOrder | null;
};

export type PaymentRetryInitiation = {
  checkoutReference: string;
  payment: {
    paymentIntentId: string;
    status: "PENDING" | "FAILED";
    checkoutUrl?: string;
    expiresAt?: string;
  };
};

export type PaymentRetry = PaymentRetryInitiation | PaymentResult;

const fail = (): never => {
  throw new Error("Invalid customer payment response.");
};

const envelope = (value: unknown) => {
  if (!record(value) || !exact(value, ["data"]) || !record(value.data))
    return fail();
  return value.data;
};

export const isSafeCheckoutUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim() !== value || !value)
    return false;
  if (isLocalPaymentSimulatorCheckoutUrl(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const parsePaymentCreate = (value: unknown): PaymentCreate => {
  const data = envelope(value);
  if (
    !exact(data, ["checkoutReference", "payment"]) ||
    !uuid(data.checkoutReference) ||
    !record(data.payment) ||
    (!exact(data.payment, ["paymentIntentId", "status", "checkoutUrl"]) &&
      !exact(data.payment, [
        "paymentIntentId",
        "status",
        "checkoutUrl",
        "expiresAt",
      ])) ||
    !uuid(data.payment.paymentIntentId) ||
    typeof data.payment.status !== "string" ||
    !["PENDING", "FAILED"].includes(data.payment.status) ||
    !isSafeCheckoutUrl(data.payment.checkoutUrl) ||
    (data.payment.expiresAt !== undefined && !date(data.payment.expiresAt))
  )
    return fail();
  return {
    checkoutReference: data.checkoutReference,
    payment: {
      paymentIntentId: data.payment.paymentIntentId,
      status: data.payment.status as "PENDING" | "FAILED",
      checkoutUrl: data.payment.checkoutUrl,
      ...(typeof data.payment.expiresAt === "string"
        ? { expiresAt: data.payment.expiresAt }
        : {}),
    },
  };
};

const paymentOrder = (value: unknown): PaymentOrder => {
  if (
    !record(value) ||
    !exact(value, ["orderId", "orderNumber", "status"]) ||
    !uuid(value.orderId) ||
    typeof value.orderNumber !== "string" ||
    !value.orderNumber.trim() ||
    value.orderNumber.length > 120 ||
    typeof value.status !== "string" ||
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.status)
  )
    return fail();
  return {
    orderId: value.orderId,
    orderNumber: value.orderNumber,
    status: value.status,
  };
};

export const parsePaymentResult = (value: unknown): PaymentResult => {
  const data = envelope(value);
  if (
    !exact(data, ["checkoutReference", "status", "order"]) ||
    !uuid(data.checkoutReference) ||
    typeof data.status !== "string" ||
    !["PENDING", "FAILED", "PAID_PROCESSING", "PAID"].includes(data.status)
  )
    return fail();
  const status = data.status as PaymentResult["status"];
  if (status !== "PAID") {
    if (data.order !== null) return fail();
    return { checkoutReference: data.checkoutReference, status, order: null };
  }
  return {
    checkoutReference: data.checkoutReference,
    status,
    order: paymentOrder(data.order),
  };
};

export const parsePaymentRetry = (value: unknown): PaymentRetry => {
  const data = envelope(value);
  if (!("payment" in data)) return parsePaymentResult(value);
  if (
    !exact(data, ["checkoutReference", "payment"]) ||
    !uuid(data.checkoutReference) ||
    !record(data.payment)
  )
    return fail();
  const payment = data.payment;
  const keys = ["paymentIntentId", "status"];
  if ("checkoutUrl" in payment) keys.push("checkoutUrl");
  if ("expiresAt" in payment) keys.push("expiresAt");
  if (
    !exact(payment, keys) ||
    !uuid(payment.paymentIntentId) ||
    typeof payment.status !== "string" ||
    !["PENDING", "FAILED"].includes(payment.status) ||
    ("checkoutUrl" in payment && !isSafeCheckoutUrl(payment.checkoutUrl)) ||
    ("expiresAt" in payment && !date(payment.expiresAt))
  )
    return fail();
  return {
    checkoutReference: data.checkoutReference,
    payment: {
      paymentIntentId: payment.paymentIntentId,
      status: payment.status as "PENDING" | "FAILED",
      ...(typeof payment.checkoutUrl === "string"
        ? { checkoutUrl: payment.checkoutUrl }
        : {}),
      ...(typeof payment.expiresAt === "string"
        ? { expiresAt: payment.expiresAt }
        : {}),
    },
  };
};
