import { createContext, useContext, type ReactNode } from "react";
import type { PolicyGateway } from "./contracts";

// Deliberately unconfigured. No client flag can enable an unimplemented API.
// Wire an authenticated gateway only after the backend activation contract is met.
const Context = createContext<PolicyGateway | undefined>(undefined);
export function PolicyGatewayProvider({
  gateway,
  children,
}: {
  gateway?: PolicyGateway;
  children?: ReactNode;
}) {
  return <Context.Provider value={gateway}>{children}</Context.Provider>;
}
export const usePolicyGateway = () => useContext(Context);
