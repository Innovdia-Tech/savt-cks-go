import type { CustomerDataController } from "../customer/state";
import type { CustomerSessionController } from "../session/controller";
import type { Binding, CatalogueController } from "./state";

/** Owns customer/catalogue binding so a background refresh cannot double-load. */
export class CatalogueRefreshCoordinator {
  private task: Promise<boolean> | null = null;
  private refreshing = false;
  private disposed = false;
  private listeners = new Set<() => void>();
  private readonly unsubscribe: (() => void)[];
  private authenticatedBinding: object | null = null;
  private needsRecoveryRefresh = false;
  constructor(
    private readonly catalogue: CatalogueController,
    private readonly customer: CustomerDataController,
    private readonly session: CustomerSessionController,
  ) {
    this.unsubscribe = [
      customer.subscribe(() => {
        if (!this.refreshing) this.sync();
      }),
      session.subscribe(() => this.sync()),
    ];
    this.sync();
  }
  private binding(): Binding {
    const s = this.session.getSnapshot(),
      c = this.customer.getSnapshot();
    if (s.phase !== "authenticated") this.authenticatedBinding = null;
    else this.authenticatedBinding ??= {};
    return {
      session: this.authenticatedBinding,
      address: this.customer.selectedAddress(),
      phase:
        c.profilePhase === "error" || c.listPhase === "error"
          ? "error"
          : c.profilePhase === "loading" || c.listPhase === "loading" || c.busy
            ? "loading"
            : "ready",
      readOnly: c.readOnly,
    };
  }
  private sync() {
    const state = this.session.getSnapshot();
    if (state.phase !== "authenticated") this.needsRecoveryRefresh = false;
    if (state.phase === "authenticated" && state.recovery === "authorizing")
      this.needsRecoveryRefresh = true;
    if (
      state.phase === "authenticated" &&
      !state.recovery &&
      this.needsRecoveryRefresh
    ) {
      const existingTask = this.task;
      void this.refresh(true);
      if (!existingTask && this.task) this.needsRecoveryRefresh = false;
      return;
    }
    if (!this.disposed && !(state.phase === "authenticated" && state.recovery))
      void this.catalogue.bind(this.binding());
  }
  getSnapshot = () => this.refreshing;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private setRefreshing(value: boolean) {
    this.refreshing = value;
    this.listeners.forEach((l) => l());
  }
  refresh = (forceAssignment = false): Promise<boolean> => {
    if (this.task) return this.task;
    const sessionState = this.session.getSnapshot();
    if (
      this.disposed ||
      sessionState.phase !== "authenticated" ||
      sessionState.recovery ||
      this.customer.getSnapshot().busy ||
      this.customer.getSnapshot().canRetryOperation
    )
      return Promise.resolve(false);
    this.task = Promise.resolve()
      .then(() => this.run(forceAssignment))
      .finally(() => {
        this.task = null;
        if (!this.disposed) {
          this.setRefreshing(false);
          this.sync();
        }
      });
    this.setRefreshing(true);
    return this.task;
  };
  private async run(forceAssignment: boolean): Promise<boolean> {
    const customerReady = await this.customer.refresh();
    if (this.disposed || this.session.getSnapshot().phase !== "authenticated")
      return false;
    const success =
      customerReady &&
      (await this.catalogue.refresh(this.binding(), forceAssignment));
    const state = this.catalogue.getSnapshot();
    if (
      !success &&
      this.customer.getSnapshot().listPhase === "ready" &&
      (["ready", "no-service"].includes(state.phase) ||
        ["NETWORK_ERROR", "REQUEST_TIMEOUT"].includes(state.error ?? ""))
    )
      this.customer.announceTransient(
        "Couldn't refresh. Check your connection and try again.",
      );
    return success;
  }
  dispose() {
    this.disposed = true;
    this.unsubscribe.forEach((off) => off());
    this.listeners.clear();
  }
}
