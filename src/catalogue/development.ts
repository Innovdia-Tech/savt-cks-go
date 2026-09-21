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
  "quote-price-changed",
  "quote-stock-changed",
  "quote-unavailable",
  "quote-assignment-mismatch",
  "quote-address-changed",
  "quote-expiry",
] as const;
export const paymentResultScenarios = [
  "pending",
  "processing",
  "paid",
  "failed",
  "paid-no-order",
] as const;
export type PaymentResultScenario = (typeof paymentResultScenarios)[number];
export class DevelopmentCatalogueAdapter {
  private scenario = "success";
  private serial = 0;
  private assignment: Assignment | null = null;
  private expiryUsed = false;
  private latestQuote: { quoteId: string; quoteToken: string } | null = null;
  private paymentIntent: {
    quoteId: string;
    paymentIntentId: string;
    checkoutUrl: string;
    idempotencyKey: string;
  } | null = null;
  private paymentResult: PaymentResultScenario = "pending";
  private paymentCreates = 0;
  private paymentResults = 0;
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
    this.latestQuote = null;
    this.paymentIntent = null;
    this.paymentResult = "pending";
    this.paymentCreates = 0;
    this.paymentResults = 0;
  }
  expire() {
    this.assignment = null;
  }
  setPaymentResult(result: PaymentResultScenario) {
    this.paymentResult = result;
  }
  paymentMetrics() {
    return {
      creates: this.paymentCreates,
      results: this.paymentResults,
      directProviderCalls: 0,
      browserOrderPosts: 0,
    };
  }
  private outlet(outletId = id(1)): Outlet {
    return {
      id: outletId,
      displayReference: outletId === id(2) ? "DEMO-02" : "DEMO-01",
      displayName:
        outletId === id(2) ? "Demo suburb outlet" : "Demo neighbourhood outlet",
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
      const outletId =
        body.customerAddressId === "55555555-5555-4555-8555-555555555555"
          ? id(2)
          : id(1);
      // Synthetic opaque handles are deterministic; production never imports this module.
      const handle = String(++this.serial).padStart(42, "A") + "A";
      this.assignment = {
        assignmentContextId: handle,
        customerAddressId: body.customerAddressId,
        addressRowVersion: body.addressRowVersion,
        outlet: this.outlet(outletId),
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
    if (u.pathname === "/api/v1/checkout/quote" && init?.method === "POST") {
      if (!h.get("x-cks-csrf")) return failure(403, "CUSTOMER_CSRF_INVALID");
      if (!h.get("Idempotency-Key")) return failure(400, "VALIDATION_FAILED");
      if (h.has("X-CKS-Assignment-Context"))
        return failure(400, "VALIDATION_FAILED");
      if (this.scenario === "quote-stock-changed")
        return failure(409, "CHECKOUT_INSUFFICIENT_STOCK");
      if (this.scenario === "quote-unavailable")
        return failure(409, "CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE");
      if (this.scenario === "quote-assignment-mismatch")
        return failure(409, "CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH");
      if (this.scenario === "quote-address-changed")
        return failure(409, "CUSTOMER_ADDRESS_CHANGED");
      const body = JSON.parse(String(init.body)) as {
        outletId: string;
        customerAddressId: string;
        deliveryType: string;
        items: Array<{ outletProductId: string; quantity: number }>;
      };
      const assignment = this.assignment;
      if (
        !assignment ||
        body.outletId !== assignment.outlet.id ||
        body.customerAddressId !== assignment.customerAddressId
      )
        return failure(409, "CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH");
      const products = new Map(
        this.products().map((product) => [product.outletProductId, product]),
      );
      const lines = body.items.map((requested, index) => {
        const product = products.get(requested.outletProductId);
        if (!product) return null;
        const unitPriceMinor =
          product.sellingPriceMinor +
          (this.scenario === "quote-price-changed" ? 100 : 0);
        return {
          outletProductId: product.outletProductId,
          productId: product.productId,
          skuCode: `SYNTH-${index + 1}`,
          productNameSnapshot: product.name,
          uomCodeSnapshot: product.uom.code,
          uomNameSnapshot: product.uom.name,
          quantity: requested.quantity,
          unitPriceMinor,
          lineSubtotalMinor: unitPriceMinor * requested.quantity,
        };
      });
      if (lines.some((line) => line === null))
        return failure(404, "CHECKOUT_OUTLET_PRODUCT_NOT_FOUND");
      const authoritative = lines as Array<NonNullable<(typeof lines)[number]>>;
      const itemsSubtotalMinor = authoritative.reduce(
        (sum, line) => sum + line.lineSubtotalMinor,
        0,
      );
      const baseDeliveryFeeMinor = 490;
      const processingFeeMinor = 50;
      const processingFeeBasisMinor = itemsSubtotalMinor + baseDeliveryFeeMinor;
      const issued = this.now();
      const quoteId = id(900 + ++this.serial);
      const quoteToken = "Q".repeat(42) + String(this.serial % 10);
      this.latestQuote = { quoteId, quoteToken };
      return Response.json({
        data: {
          quoteId,
          quoteToken,
          currency: "MYR",
          items: authoritative,
          itemsSubtotalMinor,
          discountAmountMinor: 0,
          netItemsTotalMinor: itemsSubtotalMinor,
          routeDistanceMeters: 3500,
          distanceKm: 3.5,
          routeDurationSeconds: 840,
          distanceProvider: "SYNTHETIC_ROUTES",
          deliveryBandId: id(800),
          deliverySlaMinutes: 25,
          preparationTargetMinutes: 30,
          minimumTravelSlaMinutes: 20,
          operationalAllowanceMinutes: 10,
          roundingIntervalMinutes: 5,
          googleEstimatedTravelMinutes: 14,
          committedTravelSlaMinutes: 25,
          estimatedTotalOrderMinutes: 55,
          baseDeliveryFeeMinor,
          deliveryDiscountMinor: 0,
          finalDeliveryChargeMinor: baseDeliveryFeeMinor,
          processingFeeBasisMinor,
          processingFee: {
            enabled: true,
            feeType: "FIXED",
            rate: null,
            fixedAmountMinor: processingFeeMinor,
          },
          processingFeeMinor,
          grandTotalMinor: processingFeeBasisMinor + processingFeeMinor,
          ruleReferences: {
            scheduling: { ruleId: id(801), version: 1 },
            deliveryPricing: { ruleId: id(802), version: 1 },
            deliveryTiming: { ruleId: id(803), version: 1 },
            freeDelivery: null,
            processingFee: { ruleId: id(804), version: 1 },
            refundPolicy: { ruleId: id(805), version: 1 },
          },
          deliveryPromotion: null,
          savtVoucher: null,
          quoteIssuedAt: new Date(issued).toISOString(),
          quoteExpiresAt: new Date(
            issued + (this.scenario === "quote-expiry" ? 3000 : 600000),
          ).toISOString(),
          outletId: assignment.outlet.id,
          customerAddressId: assignment.customerAddressId,
          addressRowVersion: assignment.addressRowVersion,
        },
      });
    }
    if (
      u.pathname === "/api/v1/customer/checkout/payments" &&
      init?.method === "POST"
    ) {
      if (!h.get("x-cks-csrf")) return failure(403, "CUSTOMER_CSRF_INVALID");
      const idempotencyKey = h.get("Idempotency-Key");
      if (!idempotencyKey) return failure(400, "IDEMPOTENCY_KEY_INVALID");
      const body = JSON.parse(String(init.body)) as {
        quoteId?: string;
        quoteToken?: string;
      };
      if (
        !this.latestQuote ||
        body.quoteId !== this.latestQuote.quoteId ||
        body.quoteToken !== this.latestQuote.quoteToken
      )
        return failure(409, "QUOTE_TOKEN_INVALID");
      if (
        this.paymentIntent &&
        this.paymentIntent.idempotencyKey !== idempotencyKey
      )
        return failure(409, "CHECKOUT_QUOTE_PAYMENT_ALREADY_ATTEMPTED");
      if (!this.paymentIntent) {
        const paymentIntentId = id(950 + ++this.serial);
        this.paymentIntent = {
          quoteId: body.quoteId,
          paymentIntentId,
          checkoutUrl: `https://payments.example.test/checkout/${paymentIntentId}`,
          idempotencyKey,
        };
        ++this.paymentCreates;
      }
      return Response.json(
        {
          data: {
            checkoutReference: this.paymentIntent.quoteId,
            payment: {
              paymentIntentId: this.paymentIntent.paymentIntentId,
              status: "PENDING",
              checkoutUrl: this.paymentIntent.checkoutUrl,
            },
          },
        },
        { status: 201 },
      );
    }
    if (
      u.pathname.startsWith("/api/v1/customer/checkout/payments/") &&
      init?.method === "GET"
    ) {
      const paymentIntent = this.paymentIntent;
      if (
        !paymentIntent ||
        u.pathname.split("/").at(-1) !== paymentIntent.paymentIntentId
      )
        return failure(404, "CHECKOUT_PAYMENT_NOT_FOUND");
      ++this.paymentResults;
      const status =
        this.paymentResult === "processing"
          ? "PAID_PROCESSING"
          : this.paymentResult === "paid" ||
              this.paymentResult === "paid-no-order"
            ? "PAID"
            : this.paymentResult === "failed"
              ? "FAILED"
              : "PENDING";
      return Response.json({
        data: {
          checkoutReference: paymentIntent.quoteId,
          status,
          order:
            this.paymentResult === "paid"
              ? {
                  orderId: id(990),
                  orderNumber: "SYNTH-ORDER-0001",
                  status: "CONFIRMED",
                }
              : null,
        },
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
      outlet: this.outlet(a.outlet.id),
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
