import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, type CustomerApi } from "../api/client";
import type { SessionData } from "../api/contracts";
import { CatalogueApi } from "../catalogue/api";
import { DevelopmentCatalogueAdapter } from "../catalogue/development";
import { CatalogueRefreshCoordinator } from "../catalogue/refresh";
import { CatalogueController } from "../catalogue/state";
import { QuoteApi } from "../checkout/api";
import { syncCheckoutBinding } from "../checkout/context";
import type { CheckoutQuote } from "../checkout/contracts";
import { CartController } from "../checkout/state";
import { CustomerDataApi } from "../customer/api";
import { DevelopmentDataAdapter } from "../customer/development";
import { CustomerDataController } from "../customer/state";
import { PaymentApi } from "../payment/api";
import type { PaymentResult } from "../payment/contracts";
import { PaymentController } from "../payment/state";
import type { NativeBridgePort } from "../webview/bridge";
import { CustomerSessionController } from "./controller";

const intentId = "20000000-0000-4000-8000-000000000002";
const quoteId = "10000000-0000-4000-8000-000000000001";
const operationKey = "30000000-0000-4000-8000-000000000003";
const checkoutUrl = "https://payments.example.test/checkout/approved";
const sessionData: SessionData = {
  authenticated: true,
  expiresAt: "2099-01-01T00:00:00.000Z",
  csrfToken: "D".repeat(43),
};
const bootstrap = {
  protocolVersion: "1" as const,
  launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
  state: "A".repeat(43),
  codeChallenge: "B".repeat(43),
  codeChallengeMethod: "S256" as const,
  expiresAt: sessionData.expiresAt,
};
const cleanup: (() => void)[] = [];
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose()),
);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const settle = async () => {
  for (let index = 0; index < 60; index++) await Promise.resolve();
};
const unauthorized = () =>
  Response.json(
    { error: { code: "CUSTOMER_SESSION_INVALID" } },
    { status: 401 },
  );

async function authenticatedSession() {
  const api: CustomerApi = {
    status: vi.fn(async () => sessionData),
    bootstrap: vi.fn(async () => bootstrap),
    exchange: vi.fn(async () => sessionData),
    logout: vi.fn(async () => {}),
    requestWebOtp: vi.fn(),
    authorizeWebOtp: vi.fn(),
  };
  const bridge: NativeBridgePort = {
    requestSessionRecovery: vi.fn(async () => {}),
    requestLaunchCode: vi.fn(async () => ({
      protocolVersion: "1" as const,
      launchRequestId: bootstrap.launchRequestId,
      state: bootstrap.state,
      code: "C".repeat(43),
    })),
    requestPaymentHandoff: vi.fn(async () => {}),
    clearPaymentRecovery: vi.fn(),
    notifySessionValidated: vi.fn(),
    notifyLoaded: vi.fn(),
    notifyError: vi.fn(),
  };
  const session = new CustomerSessionController(api, bridge, {
    entryMode: "embedded",
  });
  await session.start();
  return { api, bridge, session };
}

function paymentController(
  session: CustomerSessionController,
  bridge: NativeBridgePort,
  fetcher: typeof fetch,
) {
  const payment = new PaymentController(
    new PaymentApi("https://cks.example", session, fetcher),
    bridge,
    session,
    () => true,
    vi.fn(),
    Date.now,
    () => operationKey,
    async () => {},
  );
  cleanup.push(() => payment.dispose());
  return payment;
}

describe("idle resume across real authenticated API controllers", () => {
  it.each(["PENDING", "PAID_PROCESSING"] as const)(
    "preserves a %s intent across the first payment 401 and observes recovery without charging",
    async (initialStatus) => {
      const { api, bridge, session } = await authenticatedSession();
      let status: PaymentResult["status"] = initialStatus;
      let rejectOnce = false;
      const fetcher = vi.fn<typeof fetch>(async () => {
        if (rejectOnce) {
          rejectOnce = false;
          return unauthorized();
        }
        return Response.json({
          data: { checkoutReference: quoteId, status, order: null },
        });
      });
      const payment = paymentController(session, bridge, fetcher);
      await payment.restore(intentId);
      const before = fetcher.mock.calls.length;
      const grant = deferred<void>();
      vi.mocked(bridge.requestSessionRecovery!).mockReturnValueOnce(
        grant.promise,
      );
      vi.mocked(api.status).mockRejectedValueOnce(
        new ApiClientError("expired", "CUSTOMER_SESSION_INVALID"),
      );
      rejectOnce = true;
      await payment.checkStatus();
      await settle();

      expect(session.getSnapshot()).toMatchObject({
        phase: "authenticated",
        recovery: "authorizing",
      });
      expect(payment.getSnapshot()).toMatchObject({
        paymentIntentId: intentId,
        canRetryInitiation: false,
        canRetryPayment: false,
      });
      expect(fetcher).toHaveBeenCalledTimes(before + 1);
      if (initialStatus === "PAID_PROCESSING")
        expect(payment.getSnapshot().phase).toBe("paid-processing");
      expect(api.bootstrap).not.toHaveBeenCalled();

      status = "PAID_PROCESSING";
      grant.resolve();
      await vi.waitFor(() =>
        expect(payment.getSnapshot()).toMatchObject({
          phase: "paid-processing",
          error: null,
        }),
      );
      await settle();
      status = "FAILED";
      await payment.checkStatus();
      expect(payment.getSnapshot()).toMatchObject({
        phase: "paid-processing",
        paymentIntentId: intentId,
        canRetryPayment: false,
      });
      expect(bridge.clearPaymentRecovery).not.toHaveBeenCalled();
      expect(bridge.requestPaymentHandoff).not.toHaveBeenCalled();
      expect(api.bootstrap).toHaveBeenCalledOnce();
      expect(api.exchange).toHaveBeenCalledOnce();
      for (const [url, init] of fetcher.mock.calls) {
        expect(url).toBe(
          `https://cks.example/api/v1/customer/checkout/payments/${intentId}`,
        );
        expect(init).toMatchObject({
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        expect(init?.body).toBeUndefined();
      }
    },
  );

  it("holds a late successful create and native payment handoff until a valid resume finishes", async () => {
    const { api, bridge, session } = await authenticatedSession();
    const creation = deferred<Response>();
    const validation = deferred<SessionData>();
    const fetcher = vi.fn<typeof fetch>(async () => creation.promise);
    const payment = paymentController(session, bridge, fetcher);
    payment.syncQuote(
      {
        quoteId,
        quoteToken: "Q".repeat(43),
        quoteExpiresAt: sessionData.expiresAt,
      } as CheckoutQuote,
      "ready",
    );
    const initiating = payment.initiate();
    expect(fetcher).toHaveBeenCalledOnce();
    vi.mocked(api.status).mockReturnValueOnce(validation.promise);
    const resuming = session.resume();
    creation.resolve(
      Response.json({
        data: {
          checkoutReference: quoteId,
          payment: {
            paymentIntentId: intentId,
            status: "PENDING",
            checkoutUrl,
          },
        },
      }),
    );
    await settle();
    expect(session.getSnapshot()).toMatchObject({ recovery: "checking" });
    expect(payment.getSnapshot().phase).toBe("initiating");
    expect(bridge.requestPaymentHandoff).not.toHaveBeenCalled();

    validation.resolve(sessionData);
    expect(await resuming).toBe(true);
    await initiating;
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledExactlyOnceWith(
      checkoutUrl,
      intentId,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Idempotency-Key"),
    ).toBe(operationKey);
    expect(api.bootstrap).not.toHaveBeenCalled();
  });

  it("does not replay a rejected payment creation after native recovery", async () => {
    const { api, bridge, session } = await authenticatedSession();
    const fetcher = vi.fn<typeof fetch>(async () => unauthorized());
    const payment = paymentController(session, bridge, fetcher);
    payment.syncQuote(
      {
        quoteId,
        quoteToken: "Q".repeat(43),
        quoteExpiresAt: sessionData.expiresAt,
      } as CheckoutQuote,
      "ready",
    );
    vi.mocked(api.status).mockRejectedValueOnce(
      new ApiClientError("expired", "CUSTOMER_SESSION_INVALID"),
    );
    await payment.initiate();
    await vi.waitFor(() => expect(api.exchange).toHaveBeenCalledOnce());
    await settle();
    await payment.initiate();
    expect(session.getSnapshot()).toMatchObject({ phase: "authenticated" });
    expect(payment.getSnapshot()).toMatchObject({
      paymentIntentId: null,
      canRetryInitiation: false,
      canRetryPayment: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(bridge.requestPaymentHandoff).not.toHaveBeenCalled();
  });

  it("renews catalogue authority after recovery while keeping filters, detail and Basket", async () => {
    const { api, bridge, session } = await authenticatedSession();
    const data = new DevelopmentDataAdapter(false, "default");
    const transport = new DevelopmentCatalogueAdapter(false);
    transport.reset("shopping-success");
    const reads = vi.fn(transport.customerFetch(data.fetch));
    const customer = new CustomerDataController(
      new CustomerDataApi("", session, reads),
      session,
    );
    await customer.load();
    transport.setAddressLookup((id) =>
      customer.getSnapshot().addresses.find((address) => address.id === id),
    );
    let rejectDetailOnce = false;
    const requests = vi.fn<typeof fetch>(async (url, init) => {
      // This older fixture has no child directory; use the API's explicit
      // optional-route fallback rather than its generic product-list response.
      if (String(url).includes("/subcategories?"))
        return new Response(null, { status: 404 });
      if (rejectDetailOnce && String(url).includes("/products/")) {
        rejectDetailOnce = false;
        return unauthorized();
      }
      return transport.fetch(url, init);
    });
    const catalogueApi = new CatalogueApi("", session, requests);
    const catalogue = new CatalogueController(catalogueApi);
    const coordinator = new CatalogueRefreshCoordinator(
      catalogue,
      customer,
      session,
    );
    const cart = new CartController(
      new QuoteApi("", session, requests),
      catalogueApi,
    );
    const sync = () =>
      syncCheckoutBinding(
        cart,
        customer.selectedAddress(),
        catalogue.getSnapshot().assignment,
        coordinator.getSnapshot(),
      );
    const offs = [
      customer.subscribe(sync),
      catalogue.subscribe(sync),
      coordinator.subscribe(sync),
    ];
    cleanup.push(() => {
      offs.forEach((off) => off());
      coordinator.dispose();
      catalogue.dispose();
      customer.dispose();
      cart.dispose();
    });
    await vi.waitFor(() => expect(catalogue.getSnapshot().phase).toBe("ready"));
    await catalogue.search("apple");
    const categoryId = catalogue.getSnapshot().categories[0]!.id;
    await catalogue.category(categoryId);
    const product = catalogue.getSnapshot().products!.data[0]!;
    sync();
    cart.add(product, catalogue.getSnapshot().assignment!);
    await catalogue.open(product.outletProductId);
    const assignmentId =
      catalogue.getSnapshot().assignment!.assignmentContextId;
    const basket = structuredClone(cart.getSnapshot().lines);
    const requestsBefore = requests.mock.calls.length;
    const readsBefore = reads.mock.calls.length;

    vi.mocked(api.status).mockRejectedValueOnce(
      new ApiClientError("expired", "CUSTOMER_SESSION_INVALID"),
    );
    rejectDetailOnce = true;
    await catalogue.retry();
    await vi.waitFor(() => {
      expect(catalogue.getSnapshot().phase).toBe("ready");
      expect(catalogue.getSnapshot().assignment?.assignmentContextId).not.toBe(
        assignmentId,
      );
    });
    expect(catalogue.getSnapshot()).toMatchObject({
      q: "apple",
      categoryId,
      detailId: product.outletProductId,
    });
    expect(catalogue.getSnapshot().detail?.data.outletProductId).toBe(
      product.outletProductId,
    );
    expect(cart.getSnapshot().lines).toEqual(basket);
    expect(reads).toHaveBeenCalledTimes(readsBefore + 2);
    const recoveryRequests = requests.mock.calls.slice(requestsBefore);
    const writes = recoveryRequests.filter(
      ([, init]) => init?.method !== "GET",
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.[0]).toBe("/api/v1/customer/outlet-assignment");
    expect(writes[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(bridge.requestPaymentHandoff).not.toHaveBeenCalled();
    expect(bridge.notifyError).not.toHaveBeenCalled();
  });
});
