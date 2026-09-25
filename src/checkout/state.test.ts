import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../addresses/contracts";
import type { Assignment, Product } from "../catalogue/contracts";
import { QuoteError, type QuoteRequest } from "./api";
import { parseQuote, MAX_CART_LINES, MAX_LINE_QUANTITY } from "./contracts";
import { CartController } from "./state";
import { id, quoteEnvelope } from "./test-fixtures";

const uuid = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const address = (value: string, label = "Address", rowVersion = 7) =>
  ({ id: value, label, rowVersion, status: "ACTIVE" }) as Address;
const outlet = (
  outletId: string,
  addressId: string,
  rowVersion = 7,
): Assignment => ({
  assignmentContextId: "A".repeat(43),
  customerAddressId: addressId,
  addressRowVersion: rowVersion,
  outlet: {
    id: outletId,
    displayReference: "DEMO",
    displayName: `Outlet ${outletId.slice(0, 4)}`,
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  },
  resolvedAt: "2026-09-20T04:00:00.000Z",
  expiresAt: "2026-09-20T04:05:00.000Z",
});
const product = (
  outletProductId = id("2"),
  productId = id("3"),
  price = 450,
): Product => ({
  outletProductId,
  productId,
  name: "Rice",
  imageUrl: null,
  category: { id: id("4"), name: "Pantry" },
  subcategory: null,
  brand: null,
  uom: { code: "PACK", name: "Pack" },
  packSize: "1 kg",
  sellingPriceMinor: price,
  currency: "MYR",
  availability: "AVAILABLE",
});

const addressA = address(id("b"), "Home");
const assignmentA = outlet(id("a"), addressA.id);
const addressSame = address(id("c"), "Flat", 2);
const addressOther = address(id("d"), "Suburb", 3);
const assignmentSame = outlet(id("a"), addressSame.id, 2);
const assignmentOther = outlet(id("e"), addressOther.id, 3);

function fixture(
  options: {
    quote?: () => ReturnType<typeof parseQuote>;
    quoteFailure?: string;
  } = {},
) {
  const create = vi.fn(async (_request: QuoteRequest, _key: string) => {
    if (options.quoteFailure) throw new QuoteError(options.quoteFailure);
    return options.quote?.() ?? parseQuote(quoteEnvelope());
  });
  const assign = vi.fn(
    async ({ id: addressId }: { id: string; rowVersion: number }) => {
      if (addressId === addressSame.id) return assignmentSame;
      if (addressId === addressOther.id) return assignmentOther;
      return assignmentA;
    },
  );
  let key = 0;
  const controller = new CartController(
    { create },
    { assign },
    () => new Date("2026-09-20T04:00:00.000Z").getTime(),
    () => `10000000-0000-4000-8000-${String(++key).padStart(12, "0")}`,
  );
  controller.syncAssignment(addressA, assignmentA);
  return { controller, create, assign };
}

describe("real cart invariants", () => {
  it("merges only identical outletProductId lines and preserves display snapshots", () => {
    const { controller } = fixture();
    controller.add(product(), assignmentA);
    controller.add(
      { ...product(), name: "Rice updated", sellingPriceMinor: 475 },
      assignmentA,
    );
    controller.add(product(uuid(9), id("3"), 450), assignmentA);
    expect(controller.getSnapshot().lines).toEqual([
      expect.objectContaining({
        outletId: id("a"),
        outletProductId: id("2"),
        product: expect.objectContaining({
          productId: id("3"),
          name: "Rice updated",
        }),
        quantity: 2,
        displayedUnitPriceMinor: 475,
      }),
      expect.objectContaining({ outletProductId: uuid(9), quantity: 1 }),
    ]);
  });

  it("never merges by productId, name, SKU-like display data, or another outlet", () => {
    const { controller } = fixture();
    controller.add(product(uuid(1), id("3")), assignmentA);
    controller.add(product(uuid(2), id("3")), assignmentA);
    expect(controller.getSnapshot().lines).toHaveLength(2);
    expect(() => controller.add(product(uuid(3)), assignmentOther)).toThrow(
      "CART_OUTLET_MISMATCH",
    );
    expect(controller.getSnapshot().lines).toHaveLength(2);
  });

  it("enforces backend quantity, arithmetic, and 100-line limits", () => {
    const { controller } = fixture();
    controller.add(product(uuid(1)), assignmentA);
    controller.setQuantity(uuid(1), MAX_LINE_QUANTITY);
    expect(() => controller.add(product(uuid(1)), assignmentA)).toThrow(
      "CART_QUANTITY_LIMIT",
    );
    controller.remove(uuid(1));
    for (let n = 1; n <= MAX_CART_LINES; n++)
      controller.add(product(uuid(n), uuid(1000 + n), 1), assignmentA);
    expect(() =>
      controller.add(product(uuid(101), uuid(1101), 1), assignmentA),
    ).toThrow("CART_LINE_LIMIT");
    expect(() => controller.setQuantity(uuid(1), 0)).not.toThrow();
    expect(() =>
      controller.setQuantity(uuid(2), MAX_LINE_QUANTITY + 1),
    ).toThrow("CART_QUANTITY_LIMIT");
  });

  it("does not call the quote API for cart or address changes", async () => {
    const { controller, create } = fixture();
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    controller.remove(id("2"));
    await controller.requestAddress(addressSame);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("assigned address transitions", () => {
  it("preserves a same-outlet cart, invalidates its quote, and commits the candidate address", async () => {
    const { controller } = fixture();
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    expect(controller.getSnapshot().quotePhase).toBe("ready");
    await expect(controller.requestAddress(addressSame)).resolves.toBe(
      "committed",
    );
    expect(controller.getSnapshot()).toMatchObject({
      lines: [
        expect.objectContaining({ outletProductId: id("2"), quantity: 2 }),
      ],
      quote: null,
      quotePhase: "idle",
      assignment: {
        outletId: id("a"),
        customerAddressId: addressSame.id,
        addressRowVersion: 2,
      },
    });
  });

  it("switches a different outlet immediately only when the cart is empty", async () => {
    const { controller } = fixture();
    await expect(controller.requestAddress(addressOther)).resolves.toBe(
      "committed",
    );
    expect(controller.getSnapshot().assignment).toMatchObject({
      outletId: id("e"),
      customerAddressId: addressOther.id,
    });
    expect(controller.getSnapshot().pendingAddress).toBeNull();
  });

  it("keeps the committed address, outlet and cart on cancel", async () => {
    const { controller } = fixture();
    controller.add(product(), assignmentA);
    await expect(controller.requestAddress(addressOther)).resolves.toBe(
      "confirmation",
    );
    expect(controller.getSnapshot().assignment?.customerAddressId).toBe(
      addressA.id,
    );
    controller.cancelAddressChange();
    expect(controller.getSnapshot()).toMatchObject({
      assignment: { outletId: id("a"), customerAddressId: addressA.id },
      pendingAddress: null,
      lines: [expect.objectContaining({ outletProductId: id("2") })],
    });
  });

  it("clears cart and quote before adopting a confirmed different outlet", async () => {
    const { controller } = fixture();
    controller.add(product(), assignmentA);
    await controller.requestQuote();
    await controller.requestAddress(addressOther);
    const observed: Array<{
      outletId?: string;
      lines: number;
      quote: boolean;
    }> = [];
    const off = controller.subscribe(() => {
      const state = controller.getSnapshot();
      observed.push({
        outletId: state.assignment?.outletId,
        lines: state.lines.length,
        quote: !!state.quote,
      });
    });
    expect(controller.confirmAddressChange()).toBe(addressOther.id);
    off();
    expect(observed[0]).toEqual({ outletId: id("a"), lines: 0, quote: false });
    expect(controller.getSnapshot()).toMatchObject({
      assignment: { outletId: id("e"), customerAddressId: addressOther.id },
      lines: [],
      quote: null,
      pendingAddress: null,
    });
  });
});

describe("trusted quote lifecycle", () => {
  beforeEach(() => vi.useRealTimers());

  it("generates a browser UUID without detaching the Web Crypto method", async () => {
    const webCrypto = {
      randomUUID(this: object) {
        if (this !== webCrypto) throw new TypeError("Illegal invocation");
        return "10000000-0000-4000-8000-000000000001" as `${string}-${string}-${string}-${string}-${string}`;
      },
    };
    vi.stubGlobal("crypto", webCrypto);
    try {
      const create = vi.fn(async () => parseQuote(quoteEnvelope()));
      const controller = new CartController({ create }, { assign: vi.fn() });
      controller.syncAssignment(addressA, assignmentA);
      controller.add(product(), assignmentA);
      await controller.requestQuote();
      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        "10000000-0000-4000-8000-000000000001",
        expect.any(AbortSignal),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("quotes only on explicit action and sends one immutable UUIDv4 attempt", async () => {
    const { controller, create } = fixture();
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    expect(create).not.toHaveBeenCalled();
    await controller.requestQuote();
    expect(create).toHaveBeenCalledTimes(1);
    const [request, key] = create.mock.calls[0];
    expect(request).toEqual({
      outletId: id("a"),
      customerAddressId: id("b"),
      deliveryType: "NOW",
      items: [{ outletProductId: id("2"), quantity: 2 }],
    });
    expect(key).toMatch(
      /^[0-9a-f-]{14}4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("retries an offline attempt with the same body and key", async () => {
    const { controller, create } = fixture();
    create
      .mockRejectedValueOnce(new QuoteError("NETWORK_ERROR"))
      .mockResolvedValueOnce(parseQuote(quoteEnvelope()));
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    expect(controller.getSnapshot()).toMatchObject({
      quotePhase: "error",
      error: "NETWORK_ERROR",
      canRetry: true,
    });
    await controller.retryQuote();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
    expect(create.mock.calls[1][1]).toBe(create.mock.calls[0][1]);
    expect(controller.getSnapshot().quotePhase).toBe("ready");
  });

  it("requires deliberate review when authoritative line prices changed", async () => {
    const changed = quoteEnvelope();
    changed.data.items[0].unitPriceMinor = 500;
    changed.data.items[0].lineSubtotalMinor = 1000;
    changed.data.itemsSubtotalMinor = 1000;
    changed.data.netItemsTotalMinor = 1000;
    changed.data.processingFeeBasisMinor = 1490;
    changed.data.processingFeeMinor = 45;
    changed.data.grandTotalMinor = 1535;
    const { controller } = fixture({ quote: () => parseQuote(changed) });
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    expect(controller.getSnapshot()).toMatchObject({
      quotePhase: "price-review",
      priceChanged: true,
    });
    expect(controller.getSnapshot().lines[0].displayedUnitPriceMinor).toBe(450);
    controller.acceptPriceChanges();
    expect(controller.getSnapshot()).toMatchObject({
      quotePhase: "ready",
      priceChanged: false,
    });
    expect(controller.getSnapshot().lines[0].displayedUnitPriceMinor).toBe(500);
  });

  it("expires a quote and requotes only after another explicit action", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T04:00:00.000Z"));
    const create = vi.fn(async (_request: QuoteRequest, _key: string) =>
      parseQuote(quoteEnvelope()),
    );
    let key = 0;
    const controller = new CartController(
      { create },
      { assign: vi.fn() },
      Date.now,
      () => `10000000-0000-4000-8000-${String(++key).padStart(12, "0")}`,
    );
    controller.syncAssignment(addressA, assignmentA);
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    expect(controller.getSnapshot().quotePhase).toBe("ready");
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(controller.getSnapshot().quotePhase).toBe("expired");
    expect(create).toHaveBeenCalledTimes(1);
    await controller.requestQuote();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][1]).not.toBe(create.mock.calls[0][1]);
    controller.dispose();
  });
});

describe("payment quote freeze", () => {
  it("keeps the basket after confirmed failure and requires acceptance when the new payable total changes", async () => {
    const first = parseQuote(quoteEnvelope());
    const nextEnvelope = quoteEnvelope();
    const second = parseQuote({
      ...nextEnvelope,
      data: {
        ...nextEnvelope.data,
        processingFee: {
          enabled: true,
          feeType: "FIXED",
          rate: null,
          fixedAmountMinor: 142,
        },
        processingFeeMinor: 142,
        grandTotalMinor: 1532,
      },
    });
    const create = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const controller = new CartController({ create }, { assign: vi.fn() }, () =>
      Date.parse("2026-09-20T04:00:00.000Z"),
    );
    controller.syncAssignment(addressA, assignmentA);
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    expect(controller.freezeForPayment(first.quoteId)).toBe(true);

    controller.recoverBasketAfterPayment();
    expect(controller.getSnapshot()).toMatchObject({
      lines: [{ quantity: 2 }],
      paymentFrozen: false,
      quote: null,
      quotePhase: "idle",
      previousPayableTotalMinor: 1432,
    });
    await controller.requestQuote();
    expect(controller.getSnapshot()).toMatchObject({
      quotePhase: "price-review",
      priceChanged: false,
      payableTotalChanged: true,
    });
    expect(controller.freezeForPayment(second.quoteId)).toBe(false);
    controller.acceptPriceChanges();
    expect(controller.getSnapshot()).toMatchObject({
      quotePhase: "ready",
      payableTotalChanged: false,
      previousPayableTotalMinor: null,
    });
    controller.dispose();
  });
  it("freezes only the current accepted and unexpired quote", async () => {
    const { controller } = fixture();
    controller.add(product(), assignmentA);
    expect(controller.freezeForPayment(id("9"))).toBe(false);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    const quoteId = controller.getSnapshot().quote!.quoteId;
    expect(controller.freezeForPayment(id("9"))).toBe(false);
    expect(controller.freezeForPayment(quoteId)).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      quotePhase: "ready",
      paymentFrozen: true,
      quote: { quoteId },
    });
  });

  it("blocks cart, address and quote mutation while payment is active", async () => {
    const { controller, create, assign } = fixture();
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    const before = controller.getSnapshot();
    expect(controller.freezeForPayment(before.quote!.quoteId)).toBe(true);

    expect(() => controller.add(product(uuid(2)), assignmentA)).toThrow(
      "CART_PAYMENT_FROZEN",
    );
    expect(() => controller.setQuantity(id("2"), 2)).toThrow(
      "CART_PAYMENT_FROZEN",
    );
    expect(() => controller.remove(id("2"))).toThrow("CART_PAYMENT_FROZEN");
    await expect(controller.requestAddress(addressSame)).rejects.toThrow(
      "CART_PAYMENT_FROZEN",
    );
    controller.syncAssignment(addressSame, assignmentSame);
    await controller.requestQuote();
    await controller.retryQuote();
    controller.acceptPriceChanges();

    expect(create).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      ...before,
      paymentFrozen: true,
    });
  });

  it("stops quote expiry while payment owns the accepted quote", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T04:00:00.000Z"));
    const create = vi.fn(async () => parseQuote(quoteEnvelope()));
    const controller = new CartController({ create }, { assign: vi.fn() });
    controller.syncAssignment(addressA, assignmentA);
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    expect(
      controller.freezeForPayment(controller.getSnapshot().quote!.quoteId),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(controller.getSnapshot()).toMatchObject({
      quotePhase: "ready",
      paymentFrozen: true,
    });
    controller.dispose();
    vi.useRealTimers();
  });

  it("clears the payment freeze only when restarting the cart journey", async () => {
    const { controller } = fixture();
    controller.add(product(), assignmentA);
    controller.setQuantity(id("2"), 2);
    await controller.requestQuote();
    controller.freezeForPayment(controller.getSnapshot().quote!.quoteId);
    const assignment = controller.getSnapshot().assignment;
    controller.clear();
    expect(controller.getSnapshot()).toMatchObject({
      lines: [],
      quote: null,
      quotePhase: "idle",
      paymentFrozen: false,
      assignment,
    });
  });
});
