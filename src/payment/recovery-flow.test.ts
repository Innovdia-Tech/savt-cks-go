import { describe, expect, it, vi } from "vitest";
import { PaymentApi } from "./api";
import { PaymentController } from "./state";
import { consumePaymentRecoveryFragment } from "./recovery";

const id = "20000000-0000-4000-8000-000000000002";
const reference = "10000000-0000-4000-8000-000000000001";
const session = {
  getSnapshot: () => ({ phase: "authenticated" }),
  subscribe: () => () => {},
  withCredentials: <T>(operation: (csrf: string) => Promise<T>) =>
    operation("synthetic-csrf"),
};

describe("cold native recovery through the CKS HTTP boundary", () => {
  it.each(["PENDING", "PAID"] as const)(
    "uses backend %s and GET-only scoped requests",
    async (status) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json({
          data: {
            checkoutReference: reference,
            status,
            order:
              status === "PAID"
                ? {
                    orderId: "40000000-0000-4000-8000-000000000004",
                    orderNumber: "CKS-1",
                    status: "NEW",
                  }
                : null,
          },
        }),
      );
      const bridge = {
        requestPaymentHandoff: vi.fn(async () => {}),
        clearPaymentRecovery: vi.fn(),
      };
      const controller = new PaymentController(
        new PaymentApi("https://cks.example", session, fetcher),
        bridge,
        session,
        () => false,
        () => {},
        Date.now,
        () => id,
        async () => {},
      );
      const restoredId = consumePaymentRecoveryFragment(
        true,
        {
          pathname: "/",
          search: "",
          hash: `#cks-go-payment-return=${id}`,
        },
        { replaceState: vi.fn() },
      );
      await controller.restore(restoredId!);
      expect(controller.getSnapshot().phase).toBe(
        status === "PAID" ? "paid" : "retryable-pending",
      );
      for (const [url, init] of fetcher.mock.calls) {
        expect(url).toBe(
          `https://cks.example/api/v1/customer/checkout/payments/${id}`,
        );
        expect(init).toMatchObject({
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        expect(init?.body).toBeUndefined();
        expect(new Headers(init?.headers).get("x-cks-csrf")).toBeNull();
      }
      expect(bridge.requestPaymentHandoff).not.toHaveBeenCalled();
      controller.dispose();
    },
  );

  it("cannot restore another customer's payment from an opaque ID", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          error: {
            code: "PAYMENT_ATTEMPT_IDENTITY_MISMATCH",
            message: "Forbidden",
            requestId: id,
          },
        },
        { status: 403 },
      ),
    );
    const clear = vi.fn();
    const controller = new PaymentController(
      new PaymentApi("https://cks.example", session, fetcher),
      {
        requestPaymentHandoff: vi.fn(async () => {}),
        clearPaymentRecovery: clear,
      },
      session,
      () => false,
      () => {},
      Date.now,
      () => id,
      async () => {},
    );
    await controller.restore(id);
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      order: null,
    });
    expect(clear).not.toHaveBeenCalled();
    controller.dispose();
  });
});
