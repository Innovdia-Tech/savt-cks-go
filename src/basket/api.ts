import { ApiClientError } from "../api/client";
import { parseApiErrorEnvelope } from "../api/contracts";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "../checkout/contracts";
import { exact, record, uuid } from "../customer/contracts";
import type { CustomerSessionController } from "../session/controller";

export type BasketIssue =
  | "UNAVAILABLE"
  | "OUT_OF_STOCK"
  | "PRICE_UNAVAILABLE"
  | "QUANTITY_EXCEEDS_STOCK";
export type SavedBasketLine = {
  outletId: string;
  outletProductId: string;
  product: {
    productId: string;
    name: string;
    imageUrl: string | null;
    barcode?: string | null;
    packSize: string | null;
    uom: { code: string; name: string } | null;
  };
  quantity: number;
  displayedUnitPriceMinor: number;
  currency: "MYR";
  issue: BasketIssue | null;
  priceChanged: boolean;
};
export type SavedBasket = {
  customerId: string;
  revision: number;
  outletId: string | null;
  lines: SavedBasketLine[];
};
export type BasketDraft = {
  revision: number;
  mutationId: string;
  outletId: string | null;
  items: Array<{
    outletProductId: string;
    quantity: number;
    displayedUnitPriceMinor: number;
  }>;
};
export interface BasketPort {
  get(signal?: AbortSignal): Promise<SavedBasket>;
  save(draft: BasketDraft, signal?: AbortSignal): Promise<SavedBasket>;
}
export class BasketError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "BasketError";
  }
}

const integer = (
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const text = (value: unknown, max: number, empty = false): value is string =>
  typeof value === "string" &&
  (empty || value.trim().length > 0) &&
  value.length <= max;
const invalid = (): never => {
  throw new BasketError("INVALID_RESPONSE");
};
const issues: readonly unknown[] = [
  null,
  "UNAVAILABLE",
  "OUT_OF_STOCK",
  "PRICE_UNAVAILABLE",
  "QUANTITY_EXCEEDS_STOCK",
];
const money = (value: unknown) => integer(value, 0, 999_999_999_999);
const lineNumbers = (value: Record<string, unknown>) =>
  integer(value.quantity, 1, MAX_LINE_QUANTITY) &&
  money(value.displayedUnitPriceMinor) &&
  Number.isSafeInteger(
    (value.quantity as number) * (value.displayedUnitPriceMinor as number),
  );

function safeImage(value: unknown, productId: string): value is string | null {
  if (value === null) return true;
  if (!text(value, 1000)) return false;
  const managed =
    /^\/api\/v1\/product-media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(
      value,
    );
  if (managed) return managed[1] === productId.toLowerCase();
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !!url.hostname
    );
  } catch {
    return false;
  }
}

function parseLine(value: unknown, outletId: string | null): SavedBasketLine {
  if (
    !record(value) ||
    !exact(value, [
      "outletId",
      "outletProductId",
      "product",
      "quantity",
      "displayedUnitPriceMinor",
      "currency",
      "issue",
      "priceChanged",
    ]) ||
    !uuid(value.outletId) ||
    value.outletId !== outletId ||
    !uuid(value.outletProductId) ||
    !lineNumbers(value) ||
    value.currency !== "MYR" ||
    !issues.includes(value.issue) ||
    typeof value.priceChanged !== "boolean" ||
    !record(value.product)
  )
    return invalid();
  const product = value.product;
  const barcode = Object.hasOwn(product, "barcode");
  if (
    !exact(product, [
      "productId",
      "name",
      "imageUrl",
      "packSize",
      "uom",
      ...(barcode ? ["barcode"] : []),
    ]) ||
    !uuid(product.productId) ||
    !text(product.name, 200) ||
    !safeImage(product.imageUrl, product.productId) ||
    !(product.packSize === null || text(product.packSize, 120, true)) ||
    (barcode && !(product.barcode === null || text(product.barcode, 80))) ||
    !(
      product.uom === null ||
      (record(product.uom) &&
        exact(product.uom, ["code", "name"]) &&
        text(product.uom.code, 40) &&
        text(product.uom.name, 120))
    )
  )
    return invalid();
  return {
    ...value,
    product: {
      ...product,
      uom: product.uom === null ? null : { ...product.uom },
    },
  } as SavedBasketLine;
}

function parseBasket(value: unknown): SavedBasket {
  if (!record(value) || !exact(value, ["data"]) || !record(value.data))
    return invalid();
  const data = value.data;
  if (
    !exact(data, ["customerId", "revision", "outletId", "lines"]) ||
    !uuid(data.customerId) ||
    !integer(data.revision) ||
    !(data.outletId === null || uuid(data.outletId)) ||
    !Array.isArray(data.lines) ||
    data.lines.length > MAX_CART_LINES
  )
    return invalid();
  const lines = data.lines.map((line) =>
    parseLine(line, data.outletId as string | null),
  );
  if (
    new Set(lines.map((line) => line.outletProductId)).size !== lines.length ||
    !Number.isSafeInteger(
      lines.reduce(
        (sum, line) => sum + line.quantity * line.displayedUnitPriceMinor,
        0,
      ),
    )
  )
    return invalid();
  return {
    customerId: data.customerId,
    revision: data.revision,
    outletId: data.outletId,
    lines,
  };
}

function validDraft(value: unknown): value is BasketDraft {
  if (
    !record(value) ||
    !exact(value, ["revision", "mutationId", "outletId", "items"]) ||
    !integer(value.revision) ||
    !uuid(value.mutationId) ||
    !(value.outletId === null || uuid(value.outletId)) ||
    !Array.isArray(value.items) ||
    value.items.length > MAX_CART_LINES ||
    (value.items.length > 0 && value.outletId === null)
  )
    return false;
  const items = value.items;
  if (
    items.some(
      (item) =>
        !record(item) ||
        !exact(item, [
          "outletProductId",
          "quantity",
          "displayedUnitPriceMinor",
        ]) ||
        !uuid(item.outletProductId) ||
        !lineNumbers(item),
    )
  )
    return false;
  return (
    new Set(items.map((item) => item.outletProductId)).size === items.length &&
    Number.isSafeInteger(
      items.reduce(
        (sum, item) => sum + item.quantity * item.displayedUnitPriceMinor,
        0,
      ),
    )
  );
}

const safeCodes = new Set([
  "VALIDATION_FAILED",
  "BASKET_REVISION_CONFLICT",
  "BASKET_MUTATION_REUSED",
  "BASKET_OUTLET_PRODUCT_MISMATCH",
  "BASKET_INPUT_INVALID",
  "BASKET_ITEM_NOT_FOUND",
  "CUSTOMER_COMMERCE_BLOCKED",
  "BASKET_OUTLET_NOT_FOUND",
  "BASKET_OUTLET_UNAVAILABLE",
  "BASKET_PRODUCT_NOT_FOUND",
  "CUSTOMER_SESSION_INVALID",
  "CUSTOMER_CSRF_INVALID",
  "SAVT_IDENTITY_REQUIRED",
  "SAVT_IDENTITY_INVALID",
  "SAVT_IDENTITY_ADAPTER_UNAVAILABLE",
  "CUSTOMER_NOT_FOUND",
  "CUSTOMER_ORGANISATION_UNAVAILABLE",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
  "INTERNAL_ERROR",
]);

export class BasketApi implements BasketPort {
  constructor(
    private readonly origin: string,
    private readonly session: CustomerSessionController,
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private readonly timeoutMs = 15_000,
  ) {}

  get(signal?: AbortSignal): Promise<SavedBasket> {
    return this.request(undefined, signal);
  }

  save(draft: BasketDraft, signal?: AbortSignal): Promise<SavedBasket> {
    if (!validDraft(draft))
      return Promise.reject(new BasketError("VALIDATION_FAILED"));
    // Snapshot a write before credentials or asynchronous transport work can yield.
    return this.request(JSON.stringify(draft), signal);
  }

  private async request(
    body?: string,
    external?: AbortSignal,
  ): Promise<SavedBasket> {
    if (external?.aborted) throw new BasketError("CANCELLED");
    try {
      return await this.session.withCredentials(async (csrf) => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancel: () => void = () => {};
        const cancelled = new Promise<never>((_, reject) => {
          cancel = () => {
            reject(new BasketError("CANCELLED"));
            controller.abort();
          };
        });
        external?.addEventListener("abort", cancel, { once: true });
        if (external?.aborted) cancel();
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new BasketError("REQUEST_TIMEOUT"));
            controller.abort();
          }, this.timeoutMs);
        });
        const execute = async () => {
          if (external?.aborted) throw new BasketError("CANCELLED");
          const headers: Record<string, string> = {
            Accept: "application/json",
          };
          if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            headers["x-cks-csrf"] = csrf;
          }
          let response: Response;
          try {
            response = await this.fetcher(
              this.origin + "/api/v1/customer/basket",
              {
                method: body === undefined ? "GET" : "PUT",
                ...(body === undefined ? {} : { keepalive: true }),
                headers,
                credentials: "include",
                cache: "no-store",
                signal: controller.signal,
                ...(body === undefined ? {} : { body }),
              },
            );
          } catch {
            throw new BasketError(
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
              /* Server details never enter basket state. */
            }
            if (
              code === "CUSTOMER_SESSION_INVALID" ||
              code === "CUSTOMER_CSRF_INVALID" ||
              code === "SAVT_IDENTITY_INVALID"
            )
              throw new ApiClientError("expired", code);
            throw new BasketError(code);
          }
          try {
            return parseBasket(await response.json());
          } catch {
            throw new BasketError("INVALID_RESPONSE");
          }
        };
        try {
          return await Promise.race([execute(), deadline, cancelled]);
        } finally {
          clearTimeout(timer);
          external?.removeEventListener("abort", cancel);
        }
      });
    } catch (error) {
      if (error instanceof ApiClientError)
        throw new BasketError(
          error.category === "expired"
            ? "CUSTOMER_SESSION_INVALID"
            : "INVALID_RESPONSE",
        );
      throw error;
    }
  }
}
