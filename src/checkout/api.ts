import { ApiClientError } from "../api/client";
import { parseApiErrorEnvelope } from "../api/contracts";
import { uuid } from "../customer/contracts";
import type { CustomerSessionController } from "../session/controller";
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  parseQuote,
  type CheckoutQuote,
} from "./contracts";

export type QuoteRequest = {
  outletId: string;
  customerAddressId: string;
  deliveryType: "NOW";
  items: Array<{ outletProductId: string; quantity: number }>;
};

const safeCodes = new Set([
  "VALIDATION_FAILED",
  "CUSTOMER_SESSION_INVALID",
  "CUSTOMER_CSRF_INVALID",
  "SAVT_IDENTITY_REQUIRED",
  "SAVT_IDENTITY_INVALID",
  "SAVT_IDENTITY_ADAPTER_UNAVAILABLE",
  "CUSTOMER_NOT_FOUND",
  "CUSTOMER_ADDRESS_NOT_FOUND",
  "CUSTOMER_ADDRESS_INACTIVE",
  "CUSTOMER_ADDRESS_CHANGED",
  "CUSTOMER_ASSIGNMENT_INCOMPLETE",
  "CUSTOMER_NO_SERVICEABLE_OUTLET",
  "CUSTOMER_ASSIGNED_OUTLET_UNAVAILABLE",
  "CHECKOUT_LOCATION_UNAVAILABLE",
  "CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH",
  "CHECKOUT_OUTLET_PRODUCT_NOT_FOUND",
  "CHECKOUT_PRODUCT_INACTIVE",
  "CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE",
  "CHECKOUT_INSUFFICIENT_STOCK",
  "CHECKOUT_ADDRESS_NOT_SERVICEABLE",
  "CHECKOUT_ROUTE_DURATION_UNAVAILABLE",
  "CHECKOUT_SCHEDULED_DEFERRED",
  "CHECKOUT_MONEY_UNSAFE",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
  "IDEMPOTENCY_REPLAY_RESPONSE_UNAVAILABLE",
  "IDEMPOTENCY_REPLAY_TOKEN_UNAVAILABLE",
]);

export class QuoteError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class QuoteApi {
  constructor(
    private readonly origin: string,
    private readonly session: CustomerSessionController,
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private readonly timeoutMs = 15_000,
  ) {}

  async create(
    request: QuoteRequest,
    idempotencyKey: string,
    external?: AbortSignal,
  ): Promise<CheckoutQuote> {
    if (
      !uuid(request.outletId) ||
      !uuid(request.customerAddressId) ||
      request.deliveryType !== "NOW" ||
      !uuid(idempotencyKey) ||
      !Array.isArray(request.items) ||
      request.items.length < 1 ||
      request.items.length > MAX_CART_LINES ||
      request.items.some(
        (item) =>
          !uuid(item.outletProductId) ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > MAX_LINE_QUANTITY,
      ) ||
      new Set(request.items.map((item) => item.outletProductId)).size !==
        request.items.length
    )
      throw new QuoteError("VALIDATION_FAILED");
    try {
      return await this.session.withCredentials(async (csrf) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        external?.addEventListener("abort", abort, { once: true });
        if (external?.aborted) controller.abort();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const execute = async () => {
          let response: Response;
          try {
            response = await this.fetcher(
              this.origin + "/api/v1/checkout/quote",
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  "Idempotency-Key": idempotencyKey,
                  "x-cks-csrf": csrf,
                },
                credentials: "include",
                cache: "no-store",
                signal: controller.signal,
                body: JSON.stringify(request),
              },
            );
          } catch {
            throw new QuoteError(
              external?.aborted ? "CANCELLED" : "NETWORK_ERROR",
            );
          }
          if (response.status === 401)
            throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
          if (!response.ok) {
            let code = "INVALID_RESPONSE";
            try {
              const parsed = parseApiErrorEnvelope(await response.json());
              if (parsed && safeCodes.has(parsed.code)) code = parsed.code;
            } catch {
              // Untrusted backend details are intentionally discarded.
            }
            if (
              code === "CUSTOMER_SESSION_INVALID" ||
              code === "CUSTOMER_CSRF_INVALID"
            )
              throw new ApiClientError("expired", code);
            throw new QuoteError(code);
          }
          try {
            return parseQuote(await response.json());
          } catch (error) {
            if (error instanceof QuoteError) throw error;
            throw new QuoteError("INVALID_RESPONSE");
          }
        };
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new QuoteError("REQUEST_TIMEOUT"));
            controller.abort();
          }, this.timeoutMs);
        });
        try {
          return await Promise.race([execute(), deadline]);
        } finally {
          clearTimeout(timer);
          external?.removeEventListener("abort", abort);
        }
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.category === "expired")
        throw new QuoteError("CUSTOMER_SESSION_INVALID");
      throw error;
    }
  }
}
