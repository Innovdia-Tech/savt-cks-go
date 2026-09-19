import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CatalogueController } from "./state";
import type { CustomerDataController } from "../customer/state";
import type { CustomerSessionController } from "../session/controller";
const Context = createContext<{
  controller: CatalogueController;
  controls?: ReactNode;
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
  useEffect(() => {
    const sync = () => {
      const s = session.getSnapshot(),
        c = customer.getSnapshot();
      controller.bind({
        session: s.phase === "authenticated" ? s : null,
        address: customer.selectedAddress(),
        phase:
          c.profilePhase === "error" || c.listPhase === "error"
            ? "error"
            : c.profilePhase === "loading" || c.listPhase === "loading"
              ? "loading"
              : "ready",
        readOnly: c.readOnly,
      });
    };
    const offCustomer = customer.subscribe(sync),
      offSession = session.subscribe(sync);
    sync();
    return () => {
      offCustomer();
      offSession();
      controller.dispose();
    };
  }, [controller, customer, session]);
  return (
    <Context.Provider value={{ controller, controls }}>
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
