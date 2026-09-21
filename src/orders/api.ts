import { ApiClientError } from "../api/client";
import { parseApiErrorEnvelope } from "../api/contracts";
import { uuid } from "../customer/contracts";
import type { CustomerSessionController } from "../session/controller";
import {
  parseCancellation,
  parseOrderDetail,
  parseOrderList,
  type CancellationResult,
  type OrderDetail,
  type OrderPage,
} from "./contracts";

const safeCodes = new Set([
  "VALIDATION_FAILED",
  "CUSTOMER_SESSION_INVALID",
  "CUSTOMER_CSRF_INVALID",
  "SAVT_IDENTITY_REQUIRED",
  "SAVT_IDENTITY_INVALID",
  "SAVT_IDENTITY_ADAPTER_UNAVAILABLE",
  "CUSTOMER_NOT_FOUND",
  "CUSTOMER_ORDER_NOT_FOUND",
  "CUSTOMER_ORDER_QUERY_INVALID",
  "CUSTOMER_ORDER_CANCEL_BODY_INVALID",
  "CUSTOMER_ORDER_NOT_CANCELLABLE",
  "CUSTOMER_ORDER_VOUCHER_CANCELLATION_UNSUPPORTED",
  "IDEMPOTENCY_KEY_REUSED",
  "MUTATION_PRECONDITION_REQUIRED",
  "FINAL_RECEIPT_ORDER_NOT_FOUND",
  "FINAL_RECEIPT_FORBIDDEN",
  "FINAL_RECEIPT_NOT_READY",
  "FINAL_RECEIPT_INTEGRITY_FAILED",
]);

export class OrdersError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "OrdersError";
  }
}

export class OrdersApi {
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

  list(page = 1, pageSize = 25, external?: AbortSignal): Promise<OrderPage> {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      return Promise.reject(new OrdersError("VALIDATION_FAILED"));
    return this.json(
      `/api/v1/customer/orders?page=${page}&pageSize=${pageSize}`,
      { method: "GET" },
      parseOrderList,
      external,
    );
  }

  detail(orderId: string, external?: AbortSignal): Promise<OrderDetail> {
    if (!uuid(orderId))
      return Promise.reject(new OrdersError("VALIDATION_FAILED"));
    return this.json(
      `/api/v1/customer/orders/${orderId}`,
      { method: "GET" },
      parseOrderDetail,
      external,
    );
  }

  cancel(
    orderId: string,
    idempotencyKey: string,
    external?: AbortSignal,
  ): Promise<CancellationResult> {
    if (!uuid(orderId) || !uuid(idempotencyKey))
      return Promise.reject(new OrdersError("VALIDATION_FAILED"));
    return this.json(
      `/api/v1/customer/orders/${orderId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: "{}",
      },
      parseCancellation,
      external,
    );
  }

  async downloadReceipt(
    orderId: string,
    path: string,
    external?: AbortSignal,
  ): Promise<Blob> {
    const expected = `/api/v1/orders/${orderId}/receipt/download`;
    if (!uuid(orderId) || path !== expected)
      throw new OrdersError("VALIDATION_FAILED");
    return this.request(
      path,
      { method: "GET", headers: { Accept: "application/pdf" } },
      async (response) => {
        if (
          (response.headers.get("content-type") ?? "")
            .split(";", 1)[0]
            ?.trim()
            .toLowerCase() !== "application/pdf"
        )
          throw new OrdersError("INVALID_RESPONSE");
        const blob = await response.blob();
        if (blob.size === 0) throw new OrdersError("INVALID_RESPONSE");
        return blob;
      },
      external,
    );
  }

  private json<T>(
    path: string,
    init: RequestInit,
    parser: (value: unknown) => T,
    external?: AbortSignal,
  ): Promise<T> {
    return this.request(
      path,
      init,
      async (response) => {
        try {
          return parser(await response.json());
        } catch (error) {
          if (error instanceof OrdersError) throw error;
          throw new OrdersError("INVALID_RESPONSE");
        }
      },
      external,
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    consume: (response: Response) => Promise<T>,
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
            throw new OrdersError(
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
              // Untrusted response details are discarded.
            }
            if (
              code === "CUSTOMER_SESSION_INVALID" ||
              code === "CUSTOMER_CSRF_INVALID"
            )
              throw new ApiClientError("expired", code);
            throw new OrdersError(code);
          }
          return consume(response);
        };
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new OrdersError("REQUEST_TIMEOUT"));
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
        throw new OrdersError("CUSTOMER_SESSION_INVALID");
      throw error;
    }
  }
}
