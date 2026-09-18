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
  revision: 0,
});
export class CustomerDataController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private explicitSelection = false;
  private pending: AddressOperation | undefined;
  constructor(
    private readonly api: CustomerDataPort,
    session: CustomerSessionController,
  ) {
    session.subscribe(() => {
      if (session.getSnapshot().phase !== "authenticated") {
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
    this.state = { ...this.state, ...patch };
    this.emit();
  }
  selectedAddress = () =>
    this.state.addresses.find(
      (a) => a.id === this.state.selectedId && a.status === "ACTIVE",
    );
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
    if (this.state.busy || this.pending) return;
    const generation = ++this.generation;
    this.update({
      profilePhase: "loading",
      listPhase: "loading",
      error: null,
      notice: "",
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
  ): Promise<boolean> {
    if (
      this.state.busy ||
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
  async retryOperation(): Promise<boolean> {
    if (!this.pending || this.state.busy) return false;
    return this.execute();
  }
  private async execute(): Promise<boolean> {
    const op = this.pending!;
    const generation = ++this.generation;
    this.update({
      busy: true,
      error: null,
      canRetryOperation: false,
      notice: "",
    });
    try {
      await this.api.mutate(op);
      if (generation !== this.generation) return false;
      this.pending = undefined;
      this.update({ notice: "Address saved.", listPhase: "loading" });
      try {
        const addresses = await this.api.addresses();
        if (generation !== this.generation) return false;
        this.accept(addresses);
      } catch (error) {
        if (generation !== this.generation) return false;
        this.update({
          listPhase: "error",
          error: this.safeError(error),
          notice:
            "Address saved. Reload the list to see the current addresses.",
        });
      }
      this.update({ busy: false });
      return true;
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
