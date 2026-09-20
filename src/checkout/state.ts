import type { Address } from "../addresses/contracts";
import type { Assignment, Product } from "../catalogue/contracts";
import { QuoteError, type QuoteRequest } from "./api";
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  type CheckoutQuote,
} from "./contracts";

type QuotePort = {
  create(
    request: QuoteRequest,
    key: string,
    signal?: AbortSignal,
  ): Promise<CheckoutQuote>;
};
type AssignmentPort = {
  assign(
    address: { id: string; rowVersion: number },
    signal?: AbortSignal,
  ): Promise<Assignment>;
};

export type CartLine = {
  outletId: string;
  outletProductId: string;
  product: {
    productId: string;
    name: string;
    imageUrl: string | null;
    packSize: string | null;
    uom: { code: string; name: string };
  };
  quantity: number;
  displayedUnitPriceMinor: number;
  currency: "MYR";
};
export type CartAssignment = {
  outletId: string;
  outletDisplayName: string;
  outletDisplayReference: string;
  customerAddressId: string;
  addressLabel: string;
  addressRowVersion: number;
};
type PendingAddress = {
  address: Pick<Address, "id" | "label" | "rowVersion">;
  assignment: CartAssignment;
};
type QuoteAttempt = { request: QuoteRequest; key: string };
export type CartState = {
  lines: CartLine[];
  assignment: CartAssignment | null;
  pendingAddress: PendingAddress | null;
  transitionPhase: "idle" | "checking" | "confirmation" | "error";
  transitionError: string | null;
  quotePhase:
    | "idle"
    | "quoting"
    | "ready"
    | "price-review"
    | "expired"
    | "error"
    | "session-expired";
  quote: CheckoutQuote | null;
  error: string | null;
  canRetry: boolean;
  priceChanged: boolean;
};

const empty = (): CartState => ({
  lines: [],
  assignment: null,
  pendingAddress: null,
  transitionPhase: "idle",
  transitionError: null,
  quotePhase: "idle",
  quote: null,
  error: null,
  canRetry: false,
  priceChanged: false,
});
const safeAssignment = (
  address: Pick<Address, "id" | "label" | "rowVersion">,
  assignment: Assignment,
): CartAssignment => ({
  outletId: assignment.outlet.id,
  outletDisplayName: assignment.outlet.displayName,
  outletDisplayReference: assignment.outlet.displayReference,
  customerAddressId: address.id,
  addressLabel: address.label,
  addressRowVersion: address.rowVersion,
});
const codeOf = (error: unknown) =>
  error &&
  typeof error === "object" &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : "INVALID_RESPONSE";

export class CartController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private transitionGeneration = 0;
  private quoteGeneration = 0;
  private transitionAbort?: AbortController;
  private quoteAbort?: AbortController;
  private quoteTimer?: ReturnType<typeof setTimeout>;
  private attempt: QuoteAttempt | null = null;

  constructor(
    private readonly quoteApi: QuotePort,
    private readonly assignments: AssignmentPort,
    private readonly now = Date.now,
    private readonly uuid = () => crypto.randomUUID(),
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(patch: Partial<CartState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private cancelQuoteWork() {
    ++this.quoteGeneration;
    this.quoteAbort?.abort();
    this.quoteAbort = undefined;
    clearTimeout(this.quoteTimer);
  }
  private invalidateQuote() {
    this.cancelQuoteWork();
    this.attempt = null;
    this.update({
      quote: null,
      quotePhase: "idle",
      error: null,
      canRetry: false,
      priceChanged: false,
    });
  }
  private validateAssignment(
    address: Pick<Address, "id" | "rowVersion">,
    assignment: Assignment,
  ) {
    if (
      assignment.customerAddressId !== address.id ||
      assignment.addressRowVersion !== address.rowVersion ||
      assignment.outlet.availability !== "AVAILABLE"
    )
      throw new QuoteError("INVALID_RESPONSE");
  }

  syncAssignment(address: Address, assignment: Assignment) {
    this.validateAssignment(address, assignment);
    const next = safeAssignment(address, assignment);
    const current = this.state.assignment;
    if (
      current &&
      current.outletId === next.outletId &&
      current.customerAddressId === next.customerAddressId &&
      current.addressRowVersion === next.addressRowVersion
    )
      return;
    if (
      current &&
      current.outletId !== next.outletId &&
      this.state.lines.length
    ) {
      this.update({
        transitionPhase: "error",
        transitionError: "CART_OUTLET_MISMATCH",
      });
      return;
    }
    if (this.state.quote) this.invalidateQuote();
    this.update({
      assignment: next,
      transitionPhase: "idle",
      transitionError: null,
    });
  }

  add(product: Product, assignment: Assignment) {
    const committed = this.state.assignment;
    if (!committed) throw new Error("CART_ASSIGNMENT_REQUIRED");
    if (assignment.outlet.id !== committed.outletId)
      throw new Error("CART_OUTLET_MISMATCH");
    if (
      assignment.outlet.availability !== "AVAILABLE" ||
      product.availability !== "AVAILABLE"
    )
      throw new Error("CART_PRODUCT_UNAVAILABLE");
    const index = this.state.lines.findIndex(
      (line) => line.outletProductId === product.outletProductId,
    );
    const current = index < 0 ? undefined : this.state.lines[index];
    const quantity = (current?.quantity ?? 0) + 1;
    this.assertQuantity(quantity, product.sellingPriceMinor);
    if (!current && this.state.lines.length >= MAX_CART_LINES)
      throw new Error("CART_LINE_LIMIT");
    const line: CartLine = {
      outletId: committed.outletId,
      outletProductId: product.outletProductId,
      product: {
        productId: product.productId,
        name: product.name,
        imageUrl: product.imageUrl,
        packSize: product.packSize,
        uom: { ...product.uom },
      },
      quantity,
      displayedUnitPriceMinor: product.sellingPriceMinor,
      currency: "MYR",
    };
    const lines = current
      ? this.state.lines.map((value, at) => (at === index ? line : value))
      : [...this.state.lines, line];
    this.invalidateQuote();
    this.update({ lines });
  }

  setQuantity(outletProductId: string, quantity: number) {
    const line = this.state.lines.find(
      (item) => item.outletProductId === outletProductId,
    );
    if (!line) return;
    if (quantity === 0) return this.remove(outletProductId);
    this.assertQuantity(quantity, line.displayedUnitPriceMinor);
    this.invalidateQuote();
    this.update({
      lines: this.state.lines.map((item) =>
        item.outletProductId === outletProductId ? { ...item, quantity } : item,
      ),
    });
  }

  remove(outletProductId: string) {
    if (
      !this.state.lines.some((line) => line.outletProductId === outletProductId)
    )
      return;
    this.invalidateQuote();
    this.update({
      lines: this.state.lines.filter(
        (line) => line.outletProductId !== outletProductId,
      ),
    });
  }

  private assertQuantity(quantity: number, unitPriceMinor: number) {
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_LINE_QUANTITY ||
      !Number.isSafeInteger(unitPriceMinor * quantity)
    )
      throw new Error("CART_QUANTITY_LIMIT");
  }

  async requestAddress(
    address: Address,
  ): Promise<"committed" | "confirmation" | "error"> {
    const generation = ++this.transitionGeneration;
    this.transitionAbort?.abort();
    const controller = new AbortController();
    this.transitionAbort = controller;
    this.update({
      pendingAddress: null,
      transitionPhase: "checking",
      transitionError: null,
    });
    try {
      const assignment = await this.assignments.assign(
        { id: address.id, rowVersion: address.rowVersion },
        controller.signal,
      );
      if (generation !== this.transitionGeneration) return "error";
      this.validateAssignment(address, assignment);
      const next = safeAssignment(address, assignment);
      if (
        this.state.lines.length &&
        this.state.assignment?.outletId !== next.outletId
      ) {
        this.update({
          pendingAddress: {
            address: {
              id: address.id,
              label: address.label,
              rowVersion: address.rowVersion,
            },
            assignment: next,
          },
          transitionPhase: "confirmation",
        });
        return "confirmation";
      }
      this.invalidateQuote();
      this.update({
        assignment: next,
        pendingAddress: null,
        transitionPhase: "idle",
        transitionError: null,
      });
      return "committed";
    } catch (error) {
      if (generation !== this.transitionGeneration) return "error";
      this.update({
        pendingAddress: null,
        transitionPhase: "error",
        transitionError: codeOf(error),
      });
      return "error";
    }
  }

  cancelAddressChange() {
    ++this.transitionGeneration;
    this.transitionAbort?.abort();
    this.update({
      pendingAddress: null,
      transitionPhase: "idle",
      transitionError: null,
    });
  }

  confirmAddressChange(): string | null {
    const pending = this.state.pendingAddress;
    if (!pending) return null;
    this.cancelQuoteWork();
    this.attempt = null;
    this.update({
      lines: [],
      quote: null,
      quotePhase: "idle",
      error: null,
      canRetry: false,
      priceChanged: false,
    });
    this.update({
      assignment: pending.assignment,
      pendingAddress: null,
      transitionPhase: "idle",
      transitionError: null,
    });
    return pending.address.id;
  }

  async requestQuote(): Promise<void> {
    const assignment = this.state.assignment;
    if (
      !assignment ||
      !this.state.lines.length ||
      this.state.quotePhase === "quoting"
    )
      return;
    const request: QuoteRequest = {
      outletId: assignment.outletId,
      customerAddressId: assignment.customerAddressId,
      deliveryType: "NOW",
      items: this.state.lines.map((line) => ({
        outletProductId: line.outletProductId,
        quantity: line.quantity,
      })),
    };
    this.attempt = { request, key: this.uuid() };
    return this.executeQuote(this.attempt);
  }

  async retryQuote(): Promise<void> {
    if (
      !this.attempt ||
      !this.state.canRetry ||
      this.state.quotePhase === "quoting"
    )
      return;
    return this.executeQuote(this.attempt);
  }

  private async executeQuote(attempt: QuoteAttempt) {
    const generation = ++this.quoteGeneration;
    this.quoteAbort?.abort();
    const controller = new AbortController();
    this.quoteAbort = controller;
    clearTimeout(this.quoteTimer);
    this.update({
      quote: null,
      quotePhase: "quoting",
      error: null,
      canRetry: false,
      priceChanged: false,
    });
    try {
      const quote = await this.quoteApi.create(
        attempt.request,
        attempt.key,
        controller.signal,
      );
      if (generation !== this.quoteGeneration) return;
      this.validateQuote(quote, attempt.request);
      const currentPrices = new Map(
        this.state.lines.map((line) => [
          line.outletProductId,
          line.displayedUnitPriceMinor,
        ]),
      );
      const priceChanged = quote.items.some(
        (line) =>
          currentPrices.get(line.outletProductId) !== line.unitPriceMinor,
      );
      this.attempt = null;
      this.update({
        quote,
        quotePhase: priceChanged ? "price-review" : "ready",
        priceChanged,
        error: null,
        canRetry: false,
      });
      this.armExpiry(quote);
    } catch (error) {
      if (generation !== this.quoteGeneration) return;
      const code = codeOf(error);
      const canRetry = [
        "NETWORK_ERROR",
        "REQUEST_TIMEOUT",
        "INVALID_RESPONSE",
        "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      ].includes(code);
      if (!canRetry) this.attempt = null;
      this.update({
        quote: null,
        quotePhase:
          code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
        error: code,
        canRetry,
        priceChanged: false,
      });
    }
  }

  private validateQuote(quote: CheckoutQuote, request: QuoteRequest) {
    const requested = new Map(
      request.items.map((line) => [line.outletProductId, line.quantity]),
    );
    if (
      quote.items.length !== request.items.length ||
      quote.items.some(
        (line) => requested.get(line.outletProductId) !== line.quantity,
      ) ||
      (quote.outletId !== undefined && quote.outletId !== request.outletId) ||
      (quote.customerAddressId !== undefined &&
        quote.customerAddressId !== request.customerAddressId) ||
      (quote.addressRowVersion !== undefined &&
        quote.addressRowVersion !== this.state.assignment?.addressRowVersion)
    )
      throw new QuoteError("INVALID_RESPONSE");
  }

  private armExpiry(quote: CheckoutQuote) {
    clearTimeout(this.quoteTimer);
    const expire = () => {
      if (this.state.quote?.quoteId !== quote.quoteId) return;
      this.attempt = null;
      this.update({
        quotePhase: "expired",
        canRetry: false,
        priceChanged: false,
      });
    };
    const delay = Date.parse(quote.quoteExpiresAt) - this.now();
    if (delay <= 0) expire();
    else this.quoteTimer = setTimeout(expire, delay);
  }

  acceptPriceChanges() {
    const quote = this.state.quote;
    if (
      !quote ||
      this.state.quotePhase !== "price-review" ||
      Date.parse(quote.quoteExpiresAt) <= this.now()
    )
      return;
    const prices = new Map(
      quote.items.map((line) => [line.outletProductId, line.unitPriceMinor]),
    );
    this.update({
      lines: this.state.lines.map((line) => ({
        ...line,
        displayedUnitPriceMinor:
          prices.get(line.outletProductId) ?? line.displayedUnitPriceMinor,
      })),
      quotePhase: "ready",
      priceChanged: false,
    });
  }

  clear() {
    this.cancelQuoteWork();
    this.attempt = null;
    this.update({ ...empty(), assignment: this.state.assignment });
  }

  dispose() {
    ++this.transitionGeneration;
    this.transitionAbort?.abort();
    this.cancelQuoteWork();
    this.listeners.clear();
    this.state = empty();
  }
}
