import type { Address } from "../addresses/contracts";
import { CatalogueError, type CataloguePort } from "./api";
import type { Advertisement, AdvertisementAction } from "./advertisements";
import type {
  Assignment,
  CustomerCategory,
  CustomerSubcategory,
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
    | "no-service"
    | "coordinates"
    | "assignment-loading"
    | "loading"
    | "ready"
    | "error"
    | "expired"
    | "session-expired";
  assignment: Assignment | null;
  categories: CustomerCategory[];
  homeCategories: CustomerCategory[];
  subcategories: CustomerSubcategory[];
  subcategoryId?: string;
  categoryPage: number;
  categoryHasNext: boolean;
  products: Page<Product> | null;
  featured: Product[];
  advertisements: Advertisement[];
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
  homeCategories: [],
  subcategories: [],
  categoryPage: 1,
  categoryHasNext: false,
  products: null,
  featured: [],
  advertisements: [],
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
    if (phase === "assignment-loading") return this.load();
  }
  search(q: string) {
    this.update({ q, page: 1, detail: null, detailId: undefined });
    return this.load();
  }
  category(
    categoryId?: string,
    categoryPage = this.state.categoryPage,
    q = this.state.q,
  ) {
    this.update({
      categoryId,
      subcategoryId: undefined,
      subcategories: [],
      q,
      categoryPage,
      page: 1,
      detail: null,
      detailId: undefined,
    });
    return this.load();
  }
  resetFilters() {
    this.update({
      q: "",
      categoryId: undefined,
      subcategoryId: undefined,
      subcategories: [],
      page: 1,
      detail: null,
      detailId: undefined,
    });
    return this.load();
  }
  nextPage(page: number) {
    if (page < 1 || page > 1000) return Promise.resolve();
    this.update({ page, detail: null, detailId: undefined });
    return this.load();
  }
  subcategory(subcategoryId?: string) {
    if (
      !this.state.categoryId ||
      (subcategoryId &&
        !this.state.subcategories.some(
          (child) =>
            child.id === subcategoryId &&
            child.categoryId === this.state.categoryId,
        ))
    )
      return Promise.resolve(false);
    this.update({ subcategoryId, page: 1, detail: null, detailId: undefined });
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
  async resolveAdvertisement(
    action: AdvertisementAction,
  ): Promise<{ outletProductId: string } | { categoryId: string } | null> {
    const a = this.state.assignment,
      generation = this.generation;
    if (
      !a ||
      this.state.phase !== "ready" ||
      Date.parse(a.expiresAt) <= this.now()
    )
      return null;
    const signal = this.abort?.signal;
    const current = () =>
      generation === this.generation &&
      this.state.assignment?.assignmentContextId === a.assignmentContextId;
    try {
      if (action.type === "PRODUCT") {
        const result = await this.api.products(
          a,
          { page: 1, productId: action.productId },
          signal,
        );
        this.validateMeta(result.meta, a);
        if (!current() || result.data.length !== 1) return null;
        const product = result.data[0];
        if (
          product.productId !== action.productId ||
          product.availability !== "AVAILABLE"
        )
          return null;
        const detail = await this.api.detail(
          a,
          product.outletProductId,
          signal,
        );
        this.validateMeta(detail.meta, a);
        if (
          !current() ||
          detail.data.productId !== action.productId ||
          detail.data.outletProductId !== product.outletProductId ||
          detail.data.availability !== "AVAILABLE"
        )
          return null;
        return { outletProductId: product.outletProductId };
      }
      if (action.type === "CATEGORY") {
        for (let page = 1; page <= 1000; page++) {
          const result = await this.api.categories(a, { page }, signal);
          this.validateMeta(result.meta, a);
          if (!current() || result.meta.page !== page) return null;
          if (result.data.some((c) => c.id === action.categoryId))
            return { categoryId: action.categoryId };
          if (!result.meta.hasNextPage) return null;
        }
      }
    } catch {
      /* Stay in CKS Go for missing, stale or invalid targets. */
    }
    return null;
  }
  private async loadHome(
    a: Assignment,
    signal: AbortSignal,
    current: () => boolean,
  ) {
    if (!this.api.advertisements) return;
    await Promise.all([
      this.api
        .advertisements(signal)
        .catch(() => [])
        .then((advertisements) => {
          if (current()) this.update({ advertisements });
        }),
      this.api
        .products(a, { page: 1, featured: true }, signal)
        .then((result) => {
          this.validateMeta(result.meta, a);
          if (
            result.meta.page !== 1 ||
            result.data.length > 24 ||
            result.meta.pageSize > 24 ||
            result.data.some((p) => p.availability !== "AVAILABLE")
          )
            throw new CatalogueError("INVALID_RESPONSE");
          return result.data;
        })
        .catch(() => [])
        .then((featured) => {
          if (current()) this.update({ featured });
        }),
    ]);
  }
  async refresh(binding: Binding): Promise<boolean> {
    const generation = this.generation;
    const rebound = this.bind(binding);
    if (generation !== this.generation) return (await rebound) ?? false;
    return this.load(true);
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
          featured: [],
          advertisements: [],
          detail: null,
          categories: [],
          homeCategories: [],
          subcategories: [],
          subcategoryId: undefined,
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
  private async loadSubcategories(
    a: Assignment,
    categoryId: string | undefined,
    signal: AbortSignal,
  ) {
    if (!categoryId || !this.api.subcategories) return [];
    const children: CustomerSubcategory[] = [];
    let page = 1;
    let pageSize: number | undefined;
    while (page <= 1000) {
      const result = await this.api.subcategories(
        a,
        categoryId,
        { page },
        signal,
      );
      if (result === null) return [];
      this.validateMeta(result.meta, a);
      if (
        result.meta.page !== page ||
        (pageSize !== undefined && result.meta.pageSize !== pageSize) ||
        result.data.some((child) => child.categoryId !== categoryId)
      )
        throw new CatalogueError("INVALID_RESPONSE");
      pageSize = result.meta.pageSize;
      children.push(...result.data);
      if (new Set(children.map((child) => child.id)).size !== children.length)
        throw new CatalogueError("INVALID_RESPONSE");
      if (!result.meta.hasNextPage) return children;
      page++;
    }
    throw new CatalogueError("INVALID_RESPONSE");
  }
  private async load(background = false): Promise<boolean> {
    const binding = this.binding;
    if (
      !binding?.session ||
      !binding.address ||
      binding.phase !== "ready" ||
      binding.address.status !== "ACTIVE" ||
      binding.address.latitude === null ||
      binding.address.longitude === null
    )
      return false;
    let retained =
      background &&
      (this.state.phase === "no-service" ||
        (this.state.phase === "ready" &&
          this.state.assignment &&
          Date.parse(this.state.assignment.expiresAt) > this.now()))
        ? this.state
        : null;
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
          if (!retained)
            this.update({
              phase: "assignment-loading",
              assignment: null,
              products: null,
              detail: null,
              categories: [],
              homeCategories: [],
              subcategories: [],
              page: 1,
              categoryPage: 1,
              error: null,
            });
          a = await this.api.assign(
            { id: binding.address.id, rowVersion: binding.address.rowVersion },
            signal,
          );
          if (!current()) return false;
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
        if (!retained || !this.state.assignment)
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
          ...(this.state.subcategoryId
            ? { subcategoryId: this.state.subcategoryId }
            : {}),
        };
        const detailId = this.state.detailId;
        const [categories, result, subcategories] = await Promise.all([
          this.api.categories(a, { page: this.state.categoryPage }, signal),
          detailId
            ? this.api.detail(a, detailId, signal)
            : this.api.products(a, filter, signal),
          detailId
            ? Promise.resolve(this.state.subcategories)
            : this.loadSubcategories(a, filter.categoryId, signal),
        ]);
        if (!current()) return false;
        this.validateMeta(categories.meta, a);
        this.validateMeta(result.meta, a);
        if (
          detailId &&
          (result as DetailEnvelope).data.outletProductId !== detailId
        )
          throw new CatalogueError("INVALID_RESPONSE");
        if (!detailId && (result as Page<Product>).meta.page !== filter.page)
          throw new CatalogueError("INVALID_RESPONSE");
        if (
          !detailId &&
          filter.subcategoryId &&
          (result as Page<Product>).data.some(
            (product) =>
              product.category?.id !== filter.categoryId ||
              product.subcategory?.id !== filter.subcategoryId,
          )
        )
          throw new CatalogueError("INVALID_RESPONSE");
        let homeDirectory = categories.data;
        if (this.state.categoryPage === 1) {
          let hasNextPage = categories.meta.hasNextPage;
          let nextPage = categories.meta.page + 1;
          while (hasNextPage) {
            const next = await this.api.categories(
              a,
              { page: nextPage },
              signal,
            );
            if (!current()) return false;
            this.validateMeta(next.meta, a);
            if (
              next.meta.page !== nextPage ||
              next.meta.pageSize !== categories.meta.pageSize
            )
              throw new CatalogueError("INVALID_RESPONSE");
            homeDirectory = [...homeDirectory, ...next.data];
            hasNextPage = next.meta.hasNextPage;
            nextPage++;
          }
        }
        this.update({
          phase: "ready",
          categories: categories.data,
          subcategories,
          ...(this.state.categoryPage === 1
            ? { homeCategories: homeDirectory }
            : {}),
          categoryHasNext: categories.meta.hasNextPage,
          assignment: { ...a, outlet: result.meta.outlet },
          ...(detailId
            ? { detail: result as DetailEnvelope }
            : { products: result as Page<Product> }),
        });
        void this.loadHome(a, signal, current);
        this.armExpiry(a);
        return true;
      } catch (error) {
        if (!current()) return false;
        const code =
          error instanceof CatalogueError ? error.code : "INVALID_RESPONSE";
        if (
          code === "CUSTOMER_NOT_FOUND" &&
          this.bootstrapSession !== binding.session &&
          this.reloadCustomer
        ) {
          this.bootstrapSession = binding.session;
          await this.reloadCustomer();
          if (!current()) return false;
          attempt--;
          continue;
        }
        if (attempt === 0 && renewCodes.includes(code)) {
          retained = null;
          this.update({
            assignment: null,
            categories: [],
            homeCategories: [],
            subcategories: [],
            subcategoryId: undefined,
            products: null,
            featured: [],
            advertisements: [],
            detail: null,
            page: 1,
            categoryPage: 1,
          });
          continue;
        }
        if (
          retained &&
          ["NETWORK_ERROR", "REQUEST_TIMEOUT"].includes(code) &&
          (retained.phase === "no-service" ||
            (retained.assignment &&
              this.state.assignment?.assignmentContextId ===
                retained.assignment.assignmentContextId &&
              Date.parse(retained.assignment.expiresAt) > this.now()))
        ) {
          this.update(retained);
          if (retained.assignment) this.armExpiry(retained.assignment);
          return false;
        }
        this.update({
          phase:
            code === "CUSTOMER_SESSION_INVALID"
              ? "session-expired"
              : code === "CUSTOMER_NO_SERVICEABLE_OUTLET"
                ? "no-service"
                : "error",
          error: code,
          products: null,
          featured: [],
          advertisements: [],
          detail: null,
          categories: [],
          homeCategories: [],
          subcategories: [],
          ...(code === "CUSTOMER_NO_SERVICEABLE_OUTLET" ||
          renewCodes.includes(code) ||
          code === "CUSTOMER_SESSION_INVALID" ||
          code.startsWith("CUSTOMER_ADDRESS_")
            ? { assignment: null }
            : {}),
        });
        if (this.state.assignment) this.armExpiry(this.state.assignment);
        return code === "CUSTOMER_NO_SERVICEABLE_OUTLET";
      }
    }
    return false;
  }
}
