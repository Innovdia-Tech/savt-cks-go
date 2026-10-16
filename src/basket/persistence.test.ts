import { describe, expect, it, vi } from "vitest";
import { CartController } from "../checkout/state";
import { id } from "../checkout/test-fixtures";
import type { Address } from "../addresses/contracts";
import type { Assignment } from "../catalogue/contracts";
import { BasketPersistence } from "./persistence";
import type { BasketDraft, SavedBasket } from "./api";

const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const basket = (
  customerId = id("1"),
  quantity = 2,
  revision = 1,
): SavedBasket => ({
  customerId,
  revision,
  outletId: quantity ? id("a") : null,
  lines: quantity
    ? [
        {
          outletId: id("a"),
          outletProductId: id("2"),
          product: {
            productId: id("3"),
            name: "Rice",
            imageUrl: null,
            packSize: "1 kg",
            uom: null,
          },
          quantity,
          displayedUnitPriceMinor: 450,
          currency: "MYR",
          issue: null,
          priceChanged: false,
        },
      ]
    : [],
});
function setup(initial: SavedBasket = basket()) {
  let owner: string | null = initial.customerId;
  const listeners = new Set<() => void>();
  const ownerPort = {
    current: () => owner,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  const api = {
    get: vi.fn(async () => structuredClone(initial)),
    save: vi.fn(async (d: BasketDraft) =>
      basket(owner!, d.items[0]?.quantity ?? 0, d.revision + 1),
    ),
  };
  const create = vi.fn();
  const cart = new CartController({ create }, { assign: vi.fn() });
  const persistence = new BasketPersistence(cart, api, ownerPort);
  const changeOwner = (next: string | null) => {
    owner = next;
    listeners.forEach((l) => l());
  };
  return { cart, api, create, persistence, changeOwner };
}

describe("authenticated Saved Basket lifecycle", () => {
  it("restores on a new page/controller without a quote or payment", async () => {
    const f = setup();
    await tick();
    expect(f.cart.getSnapshot().lines[0]?.quantity).toBe(2);
    expect(f.cart.getSnapshot().quote).toBeNull();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
    f.persistence.dispose();
  });
  it("serializes rapid edits; an old save response cannot replace newer quantities", async () => {
    const f = setup();
    await tick();
    const pending = deferred<SavedBasket>();
    f.api.save.mockImplementationOnce(() => pending.promise);
    f.cart.setQuantity(id("2"), 3);
    await tick();
    f.cart.setQuantity(id("2"), 4);
    f.cart.setQuantity(id("2"), 5);
    await tick();
    expect(f.api.save).toHaveBeenCalledTimes(1);
    expect(f.cart.getSnapshot().basketPhase).toBe("saving");
    pending.resolve(basket(id("1"), 3, 2));
    await tick();
    expect(f.cart.getSnapshot().lines[0]?.quantity).toBe(5);
    expect(f.api.save.mock.calls[1]?.[0]).toMatchObject({
      revision: 2,
      items: [{ quantity: 5 }],
    });
    expect(f.cart.getSnapshot().basketPhase).toBe("saved");
    f.persistence.dispose();
  });
  it("retains an uncertain request identity and newest edits until explicit retry confirms persistence", async () => {
    const f = setup();
    await tick();
    f.api.save.mockRejectedValueOnce(new Error("NETWORK_ERROR"));
    f.cart.setQuantity(id("2"), 3);
    await tick();
    expect(f.cart.getSnapshot().basketPhase).toBe("save-error");
    const first = f.api.save.mock.calls[0]![0];
    await f.persistence.retry();
    await tick();
    expect(f.api.save.mock.calls[1]![0]).toEqual(first);
    expect(f.cart.getSnapshot().basketPhase).toBe("saved");
    f.persistence.dispose();
  });
  it("clears memory immediately on logout, ignores late saves, and restores the same member later", async () => {
    const f = setup();
    await tick();
    const pending = deferred<SavedBasket>();
    f.api.save.mockImplementationOnce(() => pending.promise);
    f.cart.setQuantity(id("2"), 3);
    await tick();
    f.changeOwner(null);
    expect(f.cart.getSnapshot().lines).toEqual([]);
    pending.resolve(basket(id("1"), 3, 2));
    await tick();
    expect(f.cart.getSnapshot().lines).toEqual([]);
    f.changeOwner(id("1"));
    await tick();
    expect(f.cart.getSnapshot().lines[0]?.quantity).toBe(2);
    expect(f.api.save).toHaveBeenCalledTimes(1);
    f.persistence.dispose();
  });
  it("fences a late old-account restore and rejects mismatched response ownership", async () => {
    const f = setup();
    await tick();
    const pending = deferred<SavedBasket>();
    f.api.get.mockImplementationOnce(() => pending.promise);
    f.changeOwner(null);
    f.changeOwner(id("1"));
    await tick();
    f.changeOwner(id("4"));
    await tick();
    expect(f.cart.getSnapshot().lines).toEqual([]);
    expect(f.cart.getSnapshot().basketPhase).toBe("restore-error");
    pending.resolve(basket());
    await tick();
    expect(f.cart.getSnapshot().lines).toEqual([]);
    f.persistence.dispose();
  });
  it("keeps conflict edits and requires reload instead of overwriting another device", async () => {
    const f = setup();
    await tick();
    f.api.save.mockRejectedValueOnce({ code: "BASKET_REVISION_CONFLICT" });
    f.cart.setQuantity(id("2"), 3);
    await tick();
    expect(f.cart.getSnapshot().basketPhase).toBe("conflict");
    expect(f.cart.getSnapshot().lines[0]?.quantity).toBe(3);
    await f.persistence.retry();
    expect(f.api.save).toHaveBeenCalledTimes(1);
    await f.persistence.reload();
    expect(f.cart.getSnapshot().lines[0]?.quantity).toBe(2);
    f.persistence.dispose();
  });
  it("persists removal and clear, with no quote/session/payment data in the draft", async () => {
    const f = setup();
    await tick();
    f.cart.clear();
    await tick();
    expect(f.api.save.mock.calls[0]?.[0]).toEqual({
      revision: 1,
      mutationId: expect.any(String),
      outletId: null,
      items: [],
    });
    f.persistence.dispose();
  });
  it("restores affected items visibly and allows decrease/removal but blocks increase", async () => {
    const saved = basket();
    saved.lines[0]!.issue = "OUT_OF_STOCK";
    saved.lines[0]!.priceChanged = true;
    const f = setup(saved);
    await tick();
    expect(f.cart.getSnapshot().basketReview).toBe(true);
    expect(() => f.cart.setQuantity(id("2"), 3)).toThrow(
      "CART_PRODUCT_UNAVAILABLE",
    );
    f.cart.setQuantity(id("2"), 1);
    f.cart.remove(id("2"));
    await tick();
    expect(f.cart.getSnapshot().lines).toEqual([]);
    f.persistence.dispose();
  });
  it("clears obsolete stock warnings when an adjusted quantity is confirmed", async () => {
    const saved = basket();
    saved.lines[0]!.issue = "QUANTITY_EXCEEDS_STOCK";
    const f = setup(saved);
    await tick();
    f.cart.setQuantity(id("2"), 1);
    await tick();
    expect(f.cart.getSnapshot().lines[0]?.issue).toBeNull();
    f.persistence.dispose();
  });
  it("requires reload if a lost-response replay observes another device's newer draft", async () => {
    const f = setup();
    await tick();
    f.api.save.mockRejectedValueOnce(new Error("NETWORK_ERROR"));
    f.cart.setQuantity(id("2"), 3);
    await tick();
    f.api.save.mockResolvedValueOnce(basket(id("1"), 7, 3));
    await f.persistence.retry();
    expect(f.cart.getSnapshot().basketPhase).toBe("conflict");
    expect(f.cart.getSnapshot().lines[0]?.quantity).toBe(3);
    f.persistence.dispose();
  });
  it("allows corrected edits after a definitive no-commit validation rejection", async () => {
    const f = setup();
    await tick();
    f.api.save.mockRejectedValueOnce({ code: "BASKET_ITEM_NOT_FOUND" });
    f.cart.setQuantity(id("2"), 3);
    await tick();
    const rejected = f.api.save.mock.calls[0]![0];
    f.cart.setQuantity(id("2"), 4);
    await tick();
    expect(f.api.save.mock.calls[1]?.[0].items[0]?.quantity).toBe(4);
    expect(f.api.save.mock.calls[1]?.[0].mutationId).not.toBe(
      rejected.mutationId,
    );
    expect(f.cart.getSnapshot().basketPhase).toBe("saved");
    f.persistence.dispose();
  });
  it("saves before checkout, binds its revision, and makes a later cross-device quote conflict recoverable", async () => {
    const f = setup();
    await tick();
    f.cart.syncAssignment(
      { id: id("b"), label: "Home", rowVersion: 7 } as Address,
      {
        customerAddressId: id("b"),
        addressRowVersion: 7,
        outlet: {
          id: id("a"),
          availability: "AVAILABLE",
          displayName: "Outlet",
          displayReference: "OUT",
        },
      } as Assignment,
    );
    f.create.mockRejectedValue({ code: "BASKET_REVISION_CONFLICT" });
    const saved = deferred<SavedBasket>();
    f.api.save.mockImplementationOnce(() => saved.promise);
    f.cart.setQuantity(id("2"), 3);
    const quoting = f.cart.requestQuote();
    await tick();
    expect(f.create).not.toHaveBeenCalled();
    saved.resolve(basket(id("1"), 3, 2));
    await quoting;
    expect(f.create.mock.calls[0]?.[0]).toMatchObject({
      basketRevision: 2,
      items: [{ quantity: 3 }],
    });
    expect(f.cart.getSnapshot().basketPhase).toBe("conflict");
    f.persistence.dispose();
  });
  it("view cleanup retains the application-owned persistence subscription", async () => {
    const f = setup();
    await tick();
    f.cart.releaseView();
    f.cart.setQuantity(id("2"), 3);
    await tick();
    expect(f.api.save).toHaveBeenCalledOnce();
    expect(f.cart.getSnapshot().basketPhase).toBe("saved");
    f.persistence.dispose();
  });
  it("waits for cold payment recovery, keeps pending/failed drafts frozen, then reloads authoritative paid consumption", async () => {
    let phase = "idle";
    let paymentIntentId: string | null = null;
    const listeners = new Set<() => void>();
    const payment = {
      getSnapshot: () => ({ phase, paymentIntentId }),
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      initialRecovery: true,
    };
    const api = { get: vi.fn(async () => basket()), save: vi.fn() };
    const cart = new CartController({ create: vi.fn() }, { assign: vi.fn() });
    const persistence = new BasketPersistence(
      cart,
      api,
      { current: () => id("1"), subscribe: () => () => {} },
      payment,
    );
    await tick();
    expect(api.get).not.toHaveBeenCalled();
    const state = (next: string) => {
      phase = next;
      paymentIntentId = id("6");
      listeners.forEach((l) => l());
    };
    state("checking");
    await tick();
    expect(api.get).not.toHaveBeenCalled();
    state("pending");
    await tick();
    expect(cart.getSnapshot().lines).toHaveLength(1);
    expect(cart.getSnapshot().paymentFrozen).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
    paymentIntentId = null;
    phase = "initiating";
    listeners.forEach((l) => l());
    expect(cart.getSnapshot().paymentFrozen).toBe(true);
    state("failed");
    await tick();
    expect(cart.getSnapshot().lines).toHaveLength(1);
    api.get.mockResolvedValueOnce(basket(id("1"), 0, 2));
    state("paid");
    await tick();
    expect(cart.getSnapshot().lines).toEqual([]);
    expect(api.save).not.toHaveBeenCalled();
    persistence.dispose();
  });
});
