import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CatalogueController } from "./state";
import type { CustomerDataController } from "../customer/state";
import type { CustomerSessionController } from "../session/controller";
import { CatalogueRefreshCoordinator } from "./refresh";
const Context = createContext<{
  controller: CatalogueController;
  controls?: ReactNode;
  refresh: () => Promise<boolean>;
  refreshing: boolean;
} | null>(null);
export function CatalogueProvider({
  controller,
  customer,
  session,
  controls,
  children,
}: {
  controller: CatalogueController;
  customer: CustomerDataController;
  session: CustomerSessionController;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const [coordinator, setCoordinator] =
    useState<CatalogueRefreshCoordinator | null>(null);
  const refreshing = useSyncExternalStore(
    coordinator?.subscribe ?? (() => () => {}),
    coordinator?.getSnapshot ?? (() => false),
    () => false,
  );
  useEffect(() => {
    const binding = new CatalogueRefreshCoordinator(
      controller,
      customer,
      session,
    );
    setCoordinator(binding);
    return () => {
      binding.dispose();
      controller.dispose();
    };
  }, [controller, customer, session]);
  return (
    <Context.Provider
      value={{
        controller,
        controls,
        refreshing,
        refresh: coordinator?.refresh ?? (() => Promise.resolve(false)),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCatalogue() {
  const c = useContext(Context);
  if (!c) throw new Error("Catalogue provider required.");
  const state = useSyncExternalStore(
    c.controller.subscribe,
    c.controller.getSnapshot,
    c.controller.getSnapshot,
  );
  return { ...c, state };
}
