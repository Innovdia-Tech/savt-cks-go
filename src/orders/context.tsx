import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { OrdersController } from "./state";

const Context = createContext<OrdersController | null>(null);

export function OrdersProvider({
  controller,
  children,
}: {
  controller: OrdersController;
  children: ReactNode;
}) {
  useEffect(() => () => controller.dispose(), [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}

export function useOrders() {
  const controller = useContext(Context);
  if (!controller) throw new Error("Orders provider required.");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { controller, state };
}
