import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCheckout } from "../checkout/context";
import type { PaymentController } from "./state";

type VisibilityTarget = {
  readonly visibilityState: string;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

export function installPaymentReturnObservers(
  documentTarget: VisibilityTarget,
  controller: Pick<PaymentController, "handleReturn">,
): () => void {
  let previousVisibility = documentTarget.visibilityState;
  const visibilityListener: EventListener = () => {
    const visibility = documentTarget.visibilityState;
    const returned =
      previousVisibility === "hidden" && visibility === "visible";
    previousVisibility = visibility;
    if (returned) void controller.handleReturn();
  };
  documentTarget.addEventListener("visibilitychange", visibilityListener);
  return () => {
    documentTarget.removeEventListener("visibilitychange", visibilityListener);
  };
}

const Context = createContext<PaymentController | null>(null);

export function PaymentProvider({
  controller,
  initialPaymentIntentId = null,
  children,
}: {
  controller: PaymentController;
  initialPaymentIntentId?: string | null;
  children: ReactNode;
}) {
  const checkout = useCheckout();
  useEffect(() => {
    if (initialPaymentIntentId) void controller.restore(initialPaymentIntentId);
  }, [controller, initialPaymentIntentId]);
  useEffect(() => {
    controller.syncQuote(checkout.state.quote, checkout.state.quotePhase);
  }, [controller, checkout.state.quote, checkout.state.quotePhase]);
  useEffect(
    () => installPaymentReturnObservers(document, controller),
    [controller],
  );
  useEffect(() => () => controller.dispose(), [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}

export function usePayment() {
  const controller = useContext(Context);
  if (!controller) throw new Error("Payment provider required.");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { controller, state };
}
