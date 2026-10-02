import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCatalogue } from "../catalogue/context";
import type { CustomerDataController } from "../customer/state";
import { useCustomer } from "../customer/context";
import { AddressChangeDialog } from "./components";
import type { CartController } from "./state";
import type { Address } from "../addresses/contracts";
import type { Assignment } from "../catalogue/contracts";

// During refresh retain checkout authority until the new binding is complete.
export function syncCheckoutBinding(
  controller: CartController,
  address: Address | undefined,
  assignment: Assignment | null,
  refreshing: boolean,
) {
  if (refreshing) return;
  if (
    address &&
    assignment &&
    assignment.customerAddressId === address.id &&
    assignment.addressRowVersion === address.rowVersion
  ) {
    controller.syncAssignment(address, assignment);
    return;
  }
  controller.bindSelectedAddress(address);
}

export async function requestAddressSelection(
  controller: CartController,
  customer: CustomerDataController,
  addressId: string,
): Promise<"committed" | "confirmation" | "error"> {
  const address = customer
    .getSnapshot()
    .addresses.find(
      (candidate) =>
        candidate.id === addressId && candidate.status === "ACTIVE",
    );
  if (!address) return "error";
  const result = await controller.requestAddress(address);
  if (result === "committed") customer.select(address.id);
  return result;
}

const Context = createContext<{
  controller: CartController;
  selectAddress: (
    addressId: string,
  ) => Promise<"committed" | "confirmation" | "error">;
} | null>(null);

export function CheckoutProvider({
  controller,
  customer,
  children,
}: {
  controller: CartController;
  customer: CustomerDataController;
  children: ReactNode;
}) {
  const catalogue = useCatalogue();
  const customerContext = useCustomer();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const selectAddress = useCallback(
    (addressId: string) =>
      requestAddressSelection(controller, customer, addressId),
    [controller, customer],
  );
  useEffect(() => {
    syncCheckoutBinding(
      controller,
      customer.selectedAddress(),
      catalogue.state.assignment,
      catalogue.refreshing,
    );
  }, [
    controller,
    customer,
    catalogue.state.assignment,
    catalogue.refreshing,
    customerContext.state.selectedId,
    customerContext.state.revision,
  ]);
  useEffect(() => () => controller.dispose(), [controller]);
  return (
    <Context.Provider value={{ controller, selectAddress }}>
      {children}
      <AddressChangeDialog
        state={state}
        controller={controller}
        onCommit={(addressId) => {
          customer.select(addressId);
          customer.announce(
            "Delivery address changed. Your basket was cleared.",
          );
        }}
      />
    </Context.Provider>
  );
}

export function useCheckout() {
  const context = useContext(Context);
  if (!context) throw new Error("Checkout provider required.");
  const state = useSyncExternalStore(
    context.controller.subscribe,
    context.controller.getSnapshot,
    context.controller.getSnapshot,
  );
  return { ...context, state };
}

const noCheckoutSubscribe = () => () => {};
const noCheckoutSnapshot = () => null;
export function useOptionalCheckout() {
  const context = useContext(Context);
  const state = useSyncExternalStore(
    context?.controller.subscribe ?? noCheckoutSubscribe,
    context?.controller.getSnapshot ?? noCheckoutSnapshot,
    context?.controller.getSnapshot ?? noCheckoutSnapshot,
  );
  return context ? { ...context, state: state! } : null;
}
