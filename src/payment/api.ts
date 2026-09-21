import { ApiClientError } from "../api/client";
import { parseApiErrorEnvelope } from "../api/contracts";
import { uuid } from "../customer/contracts";
import type { CustomerSessionController } from "../session/controller";
import {
  parsePaymentCreate,
  parsePaymentResult,
  type PaymentCreate,
  type PaymentResult,
} from "./contracts";

const safeCodes = new Set([
  "VALIDATION_FAILED",
  "CUSTOMER_SESSION_INVALID",
  "CUSTOMER_CSRF_INVALID",
  "SAVT_IDENTITY_REQUIRED",
  "SAVT_IDENTITY_INVALID",
  "SAVT_IDENTITY_ADAPTER_UNAVAILABLE",
  "CUSTOMER_NOT_FOUND",
  "CHECKOUT_QUOTE_NOT_FOUND",
  "QUOTE_OWNERSHIP_FORBIDDEN",
  "QUOTE_TOKEN_INVALID",
  "QUOTE_EXPIRED",
  "CHECKOUT_ITEM_UNAVAILABLE",
  "CHECKOUT_OUTLET_NOT_READY",
  "CHECKOUT_QUOTE_PAYMENT_ALREADY_ATTEMPTED",
  "CHECKOUT_PAYMENT_ALREADY_PENDING",
  "CHECKOUT_PAYMENT_NOT_FOUND",
  "IDEMPOTENCY_KEY_INVALID",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  "SAVT_PAYMENT_CREATE_FAILED",
  "SAVT_PAYMENT_INVALID_RESPONSE",
]);

export class PaymentError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PaymentError";
  }
}

export class PaymentApi {
  constructor(
    private readonly origin: string,
    private readonly session: Pick<
      CustomerSessionController,
      "withCredentials"
    >,
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private readonly timeoutMs = 15_000,
  ) {}

  async create(
    quoteId: string,
    quoteToken: string,
    idempotencyKey: string,
    external?: AbortSignal,
  ): Promise<PaymentCreate> {
    if (
      !uuid(quoteId) ||
      typeof quoteToken !== "string" ||
      !quoteToken ||
      quoteToken.length > 512 ||
      !uuid(idempotencyKey)
    )
      throw new PaymentError("VALIDATION_FAILED");
    return this.request(
      "/api/v1/customer/checkout/payments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ quoteId, quoteToken }),
      },
      parsePaymentCreate,
      external,
    );
  }

  async result(
    paymentIntentId: string,
    external?: AbortSignal,
  ): Promise<PaymentResult> {
    if (!uuid(paymentIntentId)) throw new PaymentError("VALIDATION_FAILED");
    return this.request(
      `/api/v1/customer/checkout/payments/${paymentIntentId}`,
      { method: "GET" },
      parsePaymentResult,
      external,
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    parser: (value: unknown) => T,
    external?: AbortSignal,
  ): Promise<T> {
    try {
      return await this.session.withCredentials(async (csrf) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        external?.addEventListener("abort", abort, { once: true });
        if (external?.aborted) controller.abort();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const operation = async () => {
          let response: Response;
          try {
            response = await this.fetcher(this.origin + path, {
              ...init,
              headers: {
                Accept: "application/json",
                ...(init.headers as Record<string, string> | undefined),
                ...(init.method === "POST" ? { "x-cks-csrf": csrf } : {}),
              },
              credentials: "include",
              cache: "no-store",
              signal: controller.signal,
            });
          } catch {
            throw new PaymentError(
              external?.aborted ? "CANCELLED" : "NETWORK_ERROR",
            );
          }
          if (response.status === 401)
            throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
          if (!response.ok) {
            let code = "INVALID_RESPONSE";
            try {
              const error = parseApiErrorEnvelope(await response.json());
              if (error && safeCodes.has(error.code)) code = error.code;
            } catch {
              // Untrusted backend details are intentionally discarded.
            }
            if (
              code === "CUSTOMER_SESSION_INVALID" ||
              code === "CUSTOMER_CSRF_INVALID"
            )
              throw new ApiClientError("expired", code);
            throw new PaymentError(code);
          }
          try {
            return parser(await response.json());
          } catch (error) {
            if (error instanceof PaymentError) throw error;
            throw new PaymentError("INVALID_RESPONSE");
          }
        };
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new PaymentError("REQUEST_TIMEOUT"));
            controller.abort();
          }, this.timeoutMs);
        });
        try {
          return await Promise.race([operation(), deadline]);
        } finally {
          clearTimeout(timer);
          external?.removeEventListener("abort", abort);
        }
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.category === "expired")
        throw new PaymentError("CUSTOMER_SESSION_INVALID");
      throw error;
    }
  }
}
