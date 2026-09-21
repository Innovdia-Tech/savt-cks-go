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

type FocusTarget = {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

export function installPaymentReturnObservers(
  documentTarget: VisibilityTarget,
  windowTarget: FocusTarget,
  controller: Pick<PaymentController, "handleReturn">,
): () => void {
  const observeVisible = () => {
    if (documentTarget.visibilityState === "visible")
      void controller.handleReturn();
  };
  const visibilityListener: EventListener = observeVisible;
  const focusListener: EventListener = observeVisible;
  documentTarget.addEventListener("visibilitychange", visibilityListener);
  windowTarget.addEventListener("focus", focusListener);
  return () => {
    documentTarget.removeEventListener("visibilitychange", visibilityListener);
    windowTarget.removeEventListener("focus", focusListener);
  };
}

const Context = createContext<PaymentController | null>(null);

export function PaymentProvider({
  controller,
  children,
}: {
  controller: PaymentController;
  children: ReactNode;
}) {
  const checkout = useCheckout();
  useEffect(() => {
    controller.syncQuote(checkout.state.quote, checkout.state.quotePhase);
  }, [controller, checkout.state.quote, checkout.state.quotePhase]);
  useEffect(
    () => installPaymentReturnObservers(document, window, controller),
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
