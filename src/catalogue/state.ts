import type { Address } from "../addresses/contracts";
import { CatalogueError, type CataloguePort } from "./api";
import type {
  Assignment,
  Category,
  Product,
  DetailEnvelope,
  DetailMeta,
  Page,
} from "./contracts";
export type Binding = {
  session: object | null;
  address?: Address;
  phase: "loading" | "ready" | "error";
  readOnly: boolean;
};
export type CatalogueState = {
  phase:
    | "address-loading"
    | "address-error"
    | "no-address"
    | "coordinates"
    | "assignment-loading"
    | "loading"
    | "ready"
    | "error"
    | "expired"
    | "session-expired";
  assignment: Assignment | null;
  categories: Category[];
  categoryPage: number;
  categoryHasNext: boolean;
  products: Page<Product> | null;
  detail: DetailEnvelope | null;
  detailId?: string;
  q: string;
  categoryId?: string;
  page: number;
  error: string | null;
  readOnly: boolean;
};
const empty = (): CatalogueState => ({
  phase: "address-loading",
  assignment: null,
  categories: [],
  categoryPage: 1,
  categoryHasNext: false,
  products: null,
  detail: null,
  q: "",
  page: 1,
  error: null,
  readOnly: false,
});
const renewCodes = [
  "CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED",
  "CUSTOMER_OUTLET_ASSIGNMENT_MISMATCH",
  "CUSTOMER_ASSIGNED_OUTLET_UNAVAILABLE",
];
export class CatalogueController {
  private state = empty();
  private binding: Binding | undefined;
  private generation = 0;
  private abort: AbortController | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private bootstrapSession: object | null = null;
  constructor(
    private readonly api: CataloguePort,
    private readonly now = Date.now,
    private readonly reloadCustomer?: () => Promise<void>,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<CatalogueState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  private cancel() {
    ++this.generation;
    this.abort?.abort();
    clearTimeout(this.timer);
  }
  dispose() {
    this.cancel();
    this.binding = undefined;
    this.state = empty();
  }
  bind(binding: Binding) {
    const old = this.binding,
      a = binding.address,
      b = old?.address;
    const same =
      old?.session === binding.session &&
      old?.phase === binding.phase &&
      a?.id === b?.id &&
      a?.rowVersion === b?.rowVersion &&
      a?.status === b?.status &&
      a?.latitude === b?.latitude &&
      a?.longitude === b?.longitude &&
      old?.readOnly === binding.readOnly;
    if (same) return;
    this.cancel();
    this.binding = binding;
    this.state = empty();
    let phase: CatalogueState["phase"] = "assignment-loading";
    if (!binding.session) phase = "session-expired";
    else if (binding.phase === "loading") phase = "address-loading";
    else if (binding.phase === "error") phase = "address-error";
    else if (!a || a.status !== "ACTIVE") phase = "no-address";
    else if (
      a.latitude === null ||
      a.longitude === null ||
      !Number.isFinite(a.latitude) ||
      !Number.isFinite(a.longitude)
    )
      phase = "coordinates";
    this.update({ phase, readOnly: binding.readOnly });
    if (phase === "assignment-loading") void this.load();
  }
  search(q: string) {
    this.update({ q, page: 1, detail: null, detailId: undefined });
    return this.load();
  }
  category(categoryId?: string) {
    this.update({ categoryId, page: 1, detail: null, detailId: undefined });
    return this.load();
  }
  nextPage(page: number) {
    if (page < 1 || page > 1000) return Promise.resolve();
    this.update({ page, detail: null, detailId: undefined });
    return this.load();
  }
  categoryPage(page: number) {
    this.update({ categoryPage: page });
    return this.load();
  }
  open(id: string) {
    this.update({ detailId: id, detail: null });
    return this.load();
  }
  closeDetail() {
    this.update({ detailId: undefined, detail: null });
    return this.load();
  }
  retry() {
    return this.load();
  }
  private armExpiry(a: Assignment) {
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => {
        if (
          this.state.assignment?.assignmentContextId !== a.assignmentContextId
        )
          return;
        this.cancel();
        this.update({
          phase: "expired",
          assignment: null,
          products: null,
          detail: null,
          categories: [],
          page: 1,
          error: "CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED",
        });
      },
      Math.max(0, Date.parse(a.expiresAt) - this.now()),
    );
  }
  private validateMeta(m: DetailMeta, a: Assignment) {
    if (
      m.outlet.id !== a.outlet.id ||
      m.assignmentContextExpiresAt !== a.expiresAt
    )
      throw new CatalogueError("INVALID_RESPONSE");
    if (Date.parse(a.expiresAt) <= this.now())
      throw new CatalogueError("CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED");
  }
  private async load() {
    const binding = this.binding;
    if (
      !binding?.session ||
      !binding.address ||
      binding.phase !== "ready" ||
      binding.address.status !== "ACTIVE" ||
      binding.address.latitude === null ||
      binding.address.longitude === null
    )
      return;
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.abort = controller;
    const signal = controller.signal;
    const current = () => generation === this.generation;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let a = this.state.assignment;
        if (!a || Date.parse(a.expiresAt) <= this.now()) {
          this.update({
            phase: "assignment-loading",
            assignment: null,
            products: null,
            detail: null,
            categories: [],
            page: 1,
            categoryPage: 1,
            error: null,
          });
          a = await this.api.assign(
            { id: binding.address.id, rowVersion: binding.address.rowVersion },
            signal,
          );
          if (!current()) return;
          if (
            a.customerAddressId !== binding.address.id ||
            a.addressRowVersion !== binding.address.rowVersion
          )
            throw new CatalogueError("INVALID_RESPONSE");
          if (Date.parse(a.expiresAt) <= this.now())
            throw new CatalogueError("CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED");
          this.update({ assignment: a });
        }
        this.armExpiry(a);
        this.update({
          phase: "loading",
          products: null,
          detail: null,
          error: null,
        });
        const filter = {
          page: this.state.page,
          q: this.state.q,
          categoryId: this.state.categoryId,
        };
        const detailId = this.state.detailId;
        const [categories, result] = await Promise.all([
          this.api.categories(a, { page: this.state.categoryPage }, signal),
          detailId
            ? this.api.detail(a, detailId, signal)
            : this.api.products(a, filter, signal),
        ]);
        if (!current()) return;
        this.validateMeta(categories.meta, a);
        this.validateMeta(result.meta, a);
        if (
          detailId &&
          (result as DetailEnvelope).data.outletProductId !== detailId
        )
          throw new CatalogueError("INVALID_RESPONSE");
        if (!detailId && (result as Page<Product>).meta.page !== filter.page)
          throw new CatalogueError("INVALID_RESPONSE");
        this.update({
          phase: "ready",
          categories: categories.data,
          categoryHasNext: categories.meta.hasNextPage,
          assignment: { ...a, outlet: result.meta.outlet },
          ...(detailId
            ? { detail: result as DetailEnvelope }
            : { products: result as Page<Product> }),
        });
        this.armExpiry(a);
        return;
      } catch (error) {
        if (!current()) return;
        const code =
          error instanceof CatalogueError ? error.code : "INVALID_RESPONSE";
        if (
          code === "CUSTOMER_NOT_FOUND" &&
          this.bootstrapSession !== binding.session &&
          this.reloadCustomer
        ) {
          this.bootstrapSession = binding.session;
          await this.reloadCustomer();
          if (!current()) return;
          attempt--;
          continue;
        }
        if (attempt === 0 && renewCodes.includes(code)) {
          this.update({
            assignment: null,
            categories: [],
            products: null,
            detail: null,
            page: 1,
            categoryPage: 1,
          });
          continue;
        }
        this.update({
          phase:
            code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
          error: code,
          products: null,
          detail: null,
          categories: [],
          ...(renewCodes.includes(code) ||
          code === "CUSTOMER_SESSION_INVALID" ||
          code.startsWith("CUSTOMER_ADDRESS_")
            ? { assignment: null }
            : {}),
        });
        if (this.state.assignment) this.armExpiry(this.state.assignment);
        return;
      }
    }
  }
}
