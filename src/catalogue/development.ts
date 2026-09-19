import type { Assignment, Category, Detail, Outlet } from "./contracts";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const categories: Category[] = [
  { id: id(10), name: "Pantry" },
  { id: id(11), name: "Fresh food" },
  { id: id(12), name: "Empty category" },
];
const failure = (status: number, code: string) =>
  Response.json(
    {
      error: { code, message: "Synthetic development response." },
      meta: { requestId: "synthetic-request" },
    },
    { status },
  );
export const scenarios = [
  "success",
  "null-images",
  "unavailable",
  "empty-categories",
  "empty-search",
  "empty-category",
  "expiry",
  "renewal",
  "address-changed",
  "incomplete",
  "no-service",
  "context-store",
  "blocked",
  "offline",
  "timeout",
  "malformed",
  "session-expired",
  "outlet-unavailable",
  "coordinates",
  "no-address",
] as const;
export class DevelopmentCatalogueAdapter {
  private scenario = "success";
  private serial = 0;
  private assignment: Assignment | null = null;
  private expiryUsed = false;
  constructor(
    production: boolean,
    private readonly now = Date.now,
  ) {
    if (production)
      throw new Error("Development catalogue is unavailable in production.");
  }
  reset(scenario: string) {
    this.scenario = scenario;
    this.assignment = null;
    this.expiryUsed = false;
  }
  expire() {
    this.assignment = null;
  }
  private outlet(): Outlet {
    return {
      id: id(1),
      displayReference: "DEMO-01",
      displayName: "Demo neighbourhood outlet",
      status: "ACTIVE",
      operatingState: "ONLINE",
      availability: this.scenario === "blocked" ? "UNAVAILABLE" : "AVAILABLE",
    };
  }
  private products(): Detail[] {
    return Array.from({ length: 30 }, (_, i): Detail => ({
      productId: id(100 + i),
      outletProductId: id(200 + i),
      name: `${i % 2 ? "Rice" : "Apples"} ${String(i + 1).padStart(2, "0")}`,
      imageUrl: null,
      category: categories[i % 2],
      subcategory: null,
      brand: null,
      uom: { code: "PACK", name: "Pack" },
      packSize: "1 kg",
      sellingPriceMinor: 450 + i * 25,
      currency: "MYR",
      availability:
        this.scenario === "blocked" ||
        this.scenario === "unavailable" ||
        i === 3
          ? "UNAVAILABLE"
          : "AVAILABLE",
      description:
        "Synthetic catalogue item for local acceptance. Store as directed.",
      storageType: "AMBIENT",
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
  customerFetch(fetcher: typeof fetch): typeof fetch {
    return async (input, init) => {
      const response = await fetcher(input, init);
      if (!response.ok || init?.method !== "GET") return response;
      const path = new URL(String(input), "https://synthetic.invalid").pathname;
      if (path === "/api/v1/customer/me") {
        const body = await response.json();
        return Response.json({
          data: {
            ...body.data,
            ...(this.scenario === "blocked"
              ? { accountStatus: "SUSPENDED" }
              : {}),
          },
        });
      }
      if (path === "/api/v1/customer/me/addresses") {
        const body = await response.json();
        return Response.json({
          data:
            this.scenario === "no-address"
              ? []
              : body.data.map((a: Record<string, unknown>) => ({
                  ...a,
                  latitude:
                    this.scenario === "coordinates" ? null : (a.latitude ?? 5),
                  longitude:
                    this.scenario === "coordinates"
                      ? null
                      : (a.longitude ?? 116),
                })),
        });
      }
      return response;
    };
  }
  fetch: typeof fetch = async (input, init) => {
    const u = new URL(String(input), "https://synthetic.invalid"),
      h = new Headers(init?.headers);
    if (init?.credentials !== "include")
      return failure(401, "CUSTOMER_SESSION_INVALID");
    if (this.scenario === "offline") throw new TypeError("Synthetic offline");
    if (this.scenario === "timeout")
      return new Promise((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("Aborted")),
          { once: true },
        );
      });
    if (this.scenario === "session-expired")
      return failure(401, "CUSTOMER_SESSION_INVALID");
    if (this.scenario === "malformed")
      return Response.json({ data: { unexpected: true } });
    if (this.scenario === "context-store")
      return failure(503, "CUSTOMER_ASSIGNMENT_CONTEXT_UNAVAILABLE");
    if (
      u.pathname === "/api/v1/customer/outlet-assignment" &&
      init?.method === "POST"
    ) {
      if (!h.get("x-cks-csrf")) return failure(403, "CUSTOMER_CSRF_INVALID");
      if (this.scenario === "incomplete")
        return failure(503, "CUSTOMER_ASSIGNMENT_INCOMPLETE");
      if (this.scenario === "no-service")
        return failure(422, "CUSTOMER_NO_SERVICEABLE_OUTLET");
      if (this.scenario === "address-changed")
        return failure(409, "CUSTOMER_ADDRESS_CHANGED");
      const body = JSON.parse(String(init.body));
      const t = this.now();
      // Synthetic opaque handles are deterministic; production never imports this module.
      const handle = String(++this.serial).padStart(42, "A") + "A";
      this.assignment = {
        assignmentContextId: handle,
        customerAddressId: body.customerAddressId,
        addressRowVersion: body.addressRowVersion,
        outlet: this.outlet(),
        resolvedAt: new Date(t).toISOString(),
        expiresAt: new Date(
          t + (this.scenario === "expiry" ? 3000 : 300000),
        ).toISOString(),
      };
      return Response.json({
        data: this.assignment,
        meta: { asOf: new Date(t).toISOString() },
      });
    }
    if (!h.get("X-CKS-Assignment-Context"))
      return failure(400, "CUSTOMER_ASSIGNMENT_CONTEXT_REQUIRED");
    if (this.scenario === "renewal" && !this.expiryUsed) {
      this.expiryUsed = true;
      this.assignment = null;
    }
    const a = this.assignment;
    if (
      !a ||
      h.get("X-CKS-Assignment-Context") !== a.assignmentContextId ||
      Date.parse(a.expiresAt) <= this.now()
    )
      return failure(409, "CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED");
    if (this.scenario === "outlet-unavailable")
      return failure(409, "CUSTOMER_ASSIGNED_OUTLET_UNAVAILABLE");
    if (!u.pathname.startsWith(`/api/v1/customer/outlets/${a.outlet.id}/`))
      return failure(409, "CUSTOMER_OUTLET_ASSIGNMENT_MISMATCH");
    const meta = {
      outlet: this.outlet(),
      asOf: new Date(this.now()).toISOString(),
      assignmentContextExpiresAt: a.expiresAt,
    };
    const products = this.products();
    if (/\/products\/[^/]+$/.test(u.pathname)) {
      const product = products.find(
        (p) => p.outletProductId === u.pathname.split("/").at(-1),
      );
      return product
        ? Response.json({ data: product, meta })
        : failure(404, "CUSTOMER_PRODUCT_NOT_FOUND");
    }
    const isCategories = u.pathname.endsWith("/categories");
    const q = (u.searchParams.get("q") ?? "").trim().toLowerCase(),
      category = u.searchParams.get("categoryId");
    const data = isCategories
      ? this.scenario === "empty-categories"
        ? []
        : categories
      : products
          .filter(
            (p) =>
              this.scenario !== "empty-categories" &&
              this.scenario !== "empty-search" &&
              this.scenario !== "empty-category" &&
              (!category || p.category.id === category) &&
              [
                p.name,
                p.packSize,
                p.description,
                p.category.name,
                p.uom.name,
                p.uom.code,
              ].some((s) => s?.toLowerCase().includes(q)),
          )
          .map(
            ({
              description: _description,
              storageType: _storageType,
              ...summary
            }) => summary,
          );
    const page = Number(u.searchParams.get("page") ?? 1),
      pageSize = Number(
        u.searchParams.get("pageSize") ?? (isCategories ? 50 : 24),
      );
    return Response.json({
      data: data.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        ...meta,
        page,
        pageSize,
        total: data.length,
        hasNextPage: page < 1000 && page * pageSize < data.length,
      },
    });
  };
}
