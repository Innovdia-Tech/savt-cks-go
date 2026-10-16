// @vitest-environment jsdom
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PaymentProvider } from "../payment/context";
import { PaymentController } from "../payment/state";

vi.mock("../checkout/context", () => ({
  useCheckout: () => ({ state: { quote: null, quotePhase: "idle" } }),
}));

it("keeps payment observers and session clearing across StrictMode and authenticated view remounts", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let phase = "authenticated";
  const sessionObservers = new Set<() => void>();
  const session = {
    getSnapshot: () => ({ phase }),
    subscribe: (listener: () => void) => {
      sessionObservers.add(listener);
      return () => sessionObservers.delete(listener);
    },
  };
  const controller = new PaymentController(
    { create: vi.fn(), result: vi.fn(), retry: vi.fn() },
    { requestPaymentHandoff: vi.fn() },
    session,
    () => true,
    vi.fn(),
  );
  const received: string[] = [];
  controller.subscribe(() => received.push(controller.getSnapshot().phase));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const view = () =>
    createElement(
      StrictMode,
      null,
      createElement(PaymentProvider, { controller, children: null }),
    );
  await act(async () => root.render(view()));
  await act(async () => root.render(null));
  await act(async () => root.render(view()));
  await act(async () => {
    phase = "expired";
    sessionObservers.forEach((listener) => listener());
  });
  expect(controller.getSnapshot().phase).toBe("session-expired");
  expect(received).toContain("session-expired");
  await act(async () => root.unmount());
  host.remove();
  controller.dispose();
});
