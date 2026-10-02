import type { CustomerDataPort } from "./api";
import type { Profile } from "./contracts";
import type { CustomerSessionController } from "../session/controller";
import type { Address, AddressInput } from "../addresses/contracts";
import {
  createOperation,
  type AddressAction,
  type AddressOperation,
} from "../addresses/operation";
import { CustomerDataError } from "./errors";
export type DataState = {
  profilePhase: "loading" | "ready" | "error";
  listPhase: "loading" | "ready" | "error";
  profile: Profile | null;
  addresses: Address[];
  selectedId: string | null;
  readOnly: boolean;
  busy: boolean;
  error: CustomerDataError | null;
  canRetryOperation: boolean;
  notice: string;
  noticeKind: "persistent" | "success" | "transient";
  refreshing: boolean;
  revision: number;
};
const empty = (): DataState => ({
  profilePhase: "loading",
  listPhase: "loading",
  profile: null,
  addresses: [],
  selectedId: null,
  readOnly: false,
  busy: false,
  error: null,
  canRetryOperation: false,
  notice: "",
  noticeKind: "persistent",
  refreshing: false,
  revision: 0,
});
export class CustomerDataController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private explicitSelection = false;
  private pending: AddressOperation | undefined;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private noticeRevision = 0;
  private disposed = false;
  constructor(
    private readonly api: CustomerDataPort,
    session: CustomerSessionController,
  ) {
    session.subscribe(() => {
      if (this.disposed) return;
      if (session.getSnapshot().phase !== "authenticated") {
        this.cancelNotice();
        ++this.generation;
        this.pending = undefined;
        this.explicitSelection = false;
        this.state = empty();
        this.emit();
      }
    });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach((l) => l());
  }
  private update(patch: Partial<DataState>) {
    if (this.disposed) return;
    if ("notice" in patch) this.cancelNotice();
    this.state = { ...this.state, ...patch };
    this.emit();
  }
  selectedAddress = () =>
    this.state.addresses.find(
      (a) => a.id === this.state.selectedId && a.status === "ACTIVE",
    );
  announce(message: string) {
    this.update({ notice: message, noticeKind: "persistent" });
  }
  private cancelNotice() {
    clearTimeout(this.noticeTimer);
    this.noticeTimer = undefined;
    ++this.noticeRevision;
  }
  announceTransient(
    message: string,
    kind: "success" | "transient" = "transient",
  ) {
    if (this.disposed) return;
    this.update({ notice: message, noticeKind: kind });
    const revision = this.noticeRevision;
    this.noticeTimer = setTimeout(() => {
      if (!this.disposed && revision === this.noticeRevision)
        this.update({ notice: "", noticeKind: "persistent" });
    }, 2800);
  }
  dispose() {
    this.disposed = true;
    ++this.generation;
    this.cancelNotice();
  }
  select(id: string) {
    if (
      this.state.addresses.some((a) => a.id === id && a.status === "ACTIVE")
    ) {
      this.explicitSelection = true;
      this.update({ selectedId: id });
    }
  }
  private accept(addresses: Address[]) {
    const active = addresses.filter((a) => a.status === "ACTIVE");
    const explicit = this.explicitSelection
      ? active.find((a) => a.id === this.state.selectedId)
      : undefined;
    if (!explicit) this.explicitSelection = false;
    const selectedId =
      explicit?.id ??
      active.find((a) => a.isDefault)?.id ??
      active[0]?.id ??
      null;
    this.update({
      addresses,
      selectedId,
      listPhase: "ready",
      revision: this.state.revision + 1,
    });
  }
  async load(): Promise<void> {
    this.disposed = false;
    if (this.state.busy || this.pending) return;
    const generation = ++this.generation;
    this.update({
      profilePhase: "loading",
      listPhase: "loading",
      error: null,
      notice: "",
      noticeKind: "persistent",
      refreshing: false,
    });
    try {
      const profile = await this.api.profile();
      if (generation !== this.generation) return;
      this.update({
        profile,
        profilePhase: "ready",
        readOnly: profile.accountStatus !== "ACTIVE",
      });
      const addresses = await this.api.addresses();
      if (generation !== this.generation) return;
      this.accept(addresses);
    } catch (error) {
      if (generation !== this.generation) return;
      this.update({
        profilePhase: this.state.profilePhase === "ready" ? "ready" : "error",
        listPhase: "error",
        error: this.safeError(error),
      });
    }
  }
  async mutate(
    kind: AddressAction,
    id?: string,
    input?: AddressInput,
  ): Promise<Address | false> {
    if (
      this.state.busy ||
      this.state.refreshing ||
      this.pending ||
      this.state.readOnly ||
      this.state.listPhase !== "ready" ||
      this.state.profilePhase !== "ready" ||
      this.state.error?.category === "conflict"
    )
      return false;
    try {
      this.pending = createOperation(
        kind,
        this.state.addresses.find((a) => a.id === id),
        input,
      );
    } catch {
      this.update({
        error: new CustomerDataError("validation", "INVALID_ADDRESS"),
      });
      return false;
    }
    return this.execute();
  }
  async refresh(): Promise<boolean> {
    if (
      this.disposed ||
      this.state.busy ||
      this.pending ||
      this.state.refreshing
    )
      return false;
    const generation = ++this.generation;
    this.update({ refreshing: true });
    try {
      const profile = await this.api.profile();
      if (generation !== this.generation) return false;
      const addresses = await this.api.addresses();
      if (generation !== this.generation) return false;
      this.update({
        profile,
        profilePhase: "ready",
        readOnly: profile.accountStatus !== "ACTIVE",
        error: null,
      });
      this.accept(addresses);
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      const safe = this.safeError(error);
      if (safe.category !== "offline" && safe.category !== "retryable")
        this.update({ error: safe, listPhase: "error" });
      return false;
    } finally {
      if (generation === this.generation) this.update({ refreshing: false });
    }
  }
  async retryOperation(): Promise<Address | false> {
    if (!this.pending || this.state.busy) return false;
    return this.execute();
  }
  private async execute(): Promise<Address | false> {
    const op = this.pending!;
    const generation = ++this.generation;
    this.update({
      busy: true,
      error: null,
      canRetryOperation: false,
      notice: "",
    });
    try {
      const saved = await this.api.mutate(op);
      if (generation !== this.generation) return false;
      this.pending = undefined;
      if (op.kind === "create" && this.selectedAddress())
        this.explicitSelection = true;
      this.update({ listPhase: "loading" });
      try {
        const addresses = await this.api.addresses();
        if (generation !== this.generation) return false;
        this.accept(addresses);
        this.announceTransient("Address saved", "success");
      } catch (error) {
        if (generation !== this.generation) return false;
        this.update({
          listPhase: "error",
          error: this.safeError(error),
          notice:
            "Address saved. Reload the list to see the current addresses.",
          noticeKind: "persistent",
        });
      }
      this.update({ busy: false });
      return this.state.listPhase === "ready"
        ? (this.state.addresses.find((item) => item.id === saved.id) ?? false)
        : false;
    } catch (error) {
      if (generation !== this.generation) return false;
      const safe = this.safeError(error);
      const retry =
        safe.category === "offline" || safe.category === "retryable";
      if (!retry) this.pending = undefined;
      this.update({
        busy: false,
        error: safe,
        canRetryOperation: retry,
        readOnly: this.state.readOnly || safe.category === "readOnly",
      });
      return false;
    }
  }
  private safeError(e: unknown) {
    return e instanceof CustomerDataError
      ? e
      : new CustomerDataError("invalid", "INVALID_RESPONSE");
  }
}
