import type { CartController } from "../checkout/state";
import type { BasketDraft, BasketPort } from "./api";

export type BasketOwner = {
  current(): string | null;
  subscribe(listener: () => void): () => void;
};
type PaymentRecovery = {
  getSnapshot(): { phase: string; paymentIntentId: string | null };
  subscribe(listener: () => void): () => void;
  initialRecovery?: boolean;
};
export class BasketPersistence {
  private ownerId: string | null = null;
  private generation = 0;
  private muted = false;
  private hydrated = false;
  private lastSaved = "";
  private observed = "";
  private revision = 0;
  private pending: BasketDraft | null = null;
  private running: Promise<boolean> | null = null;
  private loading: Promise<void> | null = null;
  private abort?: AbortController;
  private recoveryPending: boolean;
  private paidIntent: string | null = null;
  private readonly unsubscribe: Array<() => void>;
  constructor(
    private readonly cart: CartController,
    private readonly api: BasketPort,
    private readonly owner: BasketOwner,
    private readonly payment?: PaymentRecovery,
  ) {
    this.recoveryPending = Boolean(payment?.initialRecovery);
    cart.connectPersistence(this);
    cart.setBasketStatus("loading");
    this.unsubscribe = [
      owner.subscribe(() => this.bindOwner()),
      cart.subscribe(() => this.changed()),
    ];
    if (payment)
      this.unsubscribe.push(payment.subscribe(() => this.observePayment()));
    this.bindOwner();
  }
  private projection() {
    const lines = this.cart.getSnapshot().lines;
    return {
      outletId: lines[0]?.outletId ?? null,
      items: lines.map((line) => ({
        outletProductId: line.outletProductId,
        quantity: line.quantity,
        displayedUnitPriceMinor: line.displayedUnitPriceMinor,
      })),
    };
  }
  private signature() {
    return JSON.stringify(this.projection());
  }
  private bindOwner() {
    const id = this.recoveryPending ? null : this.owner.current();
    if (id === this.ownerId) return;
    this.ownerId = id;
    ++this.generation;
    this.abort?.abort();
    this.pending = null;
    this.running = null;
    this.loading = null;
    this.hydrated = false;
    this.muted = true;
    this.cart.resetSessionBasket();
    this.muted = false;
    this.cart.setBasketStatus("loading");
    if (id) void this.reload();
  }
  private lockPayment() {
    const state = this.payment?.getSnapshot();
    if (!state) return;
    if (["idle", "ready"].includes(state.phase))
      this.cart.setPaymentRecoveryLocked(false);
    else if (
      state.paymentIntentId ||
      ["initiating", "retrying"].includes(state.phase)
    )
      this.cart.setPaymentRecoveryLocked(true);
  }
  private observePayment() {
    const state = this.payment!.getSnapshot();
    if (
      [
        "pending",
        "retryable-pending",
        "failed",
        "paid-processing",
        "paid",
      ].includes(state.phase)
    )
      this.recoveryPending = false;
    this.bindOwner();
    this.lockPayment();
    if (
      state.phase === "paid" &&
      state.paymentIntentId &&
      this.ownerId &&
      this.paidIntent !== state.paymentIntentId
    ) {
      this.paidIntent = state.paymentIntentId;
      void this.reload();
    }
  }
  private changed() {
    if (this.muted || !this.hydrated || !this.ownerId) return;
    const signature = this.signature();
    if (signature === this.observed) return;
    this.observed = signature;
    if (this.cart.getSnapshot().basketPhase === "conflict") return;
    this.cart.setBasketStatus("saving");
    // Coalesce a committed transition's synchronous updates; writes remain ordered.
    queueMicrotask(() => {
      if (this.hydrated && this.ownerId) void this.flush();
    });
  }
  async flush(): Promise<boolean> {
    if (this.loading) await this.loading;
    if (
      !this.ownerId ||
      !this.hydrated ||
      this.cart.getSnapshot().basketPhase === "conflict"
    )
      return false;
    if (this.running) return this.running;
    const generation = this.generation;
    const work = async (): Promise<boolean> => {
      while (generation === this.generation && this.ownerId) {
        if (!this.pending && this.signature() === this.lastSaved) {
          this.cart.setBasketStatus("saved", this.revision);
          return true;
        }
        this.pending ??= {
          revision: this.revision,
          mutationId: crypto.randomUUID(),
          ...this.projection(),
        };
        const draft = this.pending;
        this.cart.setBasketStatus("saving");
        try {
          this.abort = new AbortController();
          const saved = await this.api.save(draft, this.abort.signal);
          if (generation !== this.generation) return false;
          if (
            saved.customerId !== this.ownerId ||
            saved.revision <= draft.revision
          )
            throw new Error("INVALID_RESPONSE");
          if (
            saved.revision !== draft.revision + 1 ||
            saved.outletId !== draft.outletId ||
            saved.lines.length !== draft.items.length ||
            saved.lines.some(
              (line) =>
                !draft.items.some(
                  (item) =>
                    item.outletProductId === line.outletProductId &&
                    item.quantity === line.quantity,
                ),
            )
          ) {
            this.cart.setBasketStatus("conflict");
            return false;
          }
          const requestSignature = JSON.stringify({
            outletId: draft.outletId,
            items: draft.items,
          });
          const unchanged = this.signature() === requestSignature;
          this.muted = true;
          this.cart.revalidateSavedLines(saved, draft.items);
          this.muted = false;
          this.observed = this.signature();
          this.revision = saved.revision;
          this.pending = null;
          this.lastSaved = unchanged ? this.signature() : requestSignature;
        } catch (error) {
          if (generation !== this.generation) return false;
          const code =
            error && typeof error === "object" && "code" in error
              ? error.code
              : null;
          if (
            [
              "BASKET_INPUT_INVALID",
              "BASKET_ITEM_NOT_FOUND",
              "BASKET_OUTLET_NOT_FOUND",
              "CUSTOMER_COMMERCE_BLOCKED",
              "VALIDATION_FAILED",
            ].includes(String(code))
          )
            this.pending = null;
          this.cart.setBasketStatus(
            code === "BASKET_REVISION_CONFLICT" ? "conflict" : "save-error",
          );
          return false;
        }
      }
      return false;
    };
    // Install before invoking async work, whose status notification can reenter.
    const run = Promise.resolve().then(work);
    this.running = run;
    try {
      return await run;
    } finally {
      if (this.running === run) this.running = null;
    }
  }
  async retry() {
    if (this.cart.getSnapshot().basketPhase === "restore-error")
      await this.reload();
    else if (this.cart.getSnapshot().basketPhase !== "conflict")
      await this.flush();
  }
  async reload() {
    if (!this.ownerId) return;
    ++this.generation;
    const generation = this.generation;
    this.abort?.abort();
    this.abort = new AbortController();
    this.hydrated = false;
    this.running = null;
    this.pending = null;
    this.cart.setBasketStatus("loading");
    const load = async () => {
      try {
        const saved = await this.api.get(this.abort!.signal);
        if (generation !== this.generation) return;
        if (saved.customerId !== this.ownerId)
          throw new Error("INVALID_RESPONSE");
        this.revision = saved.revision;
        this.muted = true;
        this.cart.restoreSavedBasket(saved);
        this.muted = false;
        this.lastSaved = this.signature();
        this.observed = this.lastSaved;
        this.hydrated = true;
        this.lockPayment();
      } catch {
        if (generation === this.generation)
          this.cart.setBasketStatus("restore-error");
      }
    };
    const loading = load();
    this.loading = loading;
    try {
      await loading;
    } finally {
      if (this.loading === loading) this.loading = null;
    }
  }
  dispose() {
    ++this.generation;
    this.abort?.abort();
    this.unsubscribe.forEach((fn) => fn());
    this.cart.connectPersistence(undefined);
  }
}
