import { createContext, useContext, type ReactNode } from "react";
import type { PublishedPolicyGateway } from "./published";

const PublishedContext = createContext<PublishedPolicyGateway | undefined>(
  undefined,
);
export function PublishedPolicyProvider({
  gateway,
  children,
}: {
  gateway: PublishedPolicyGateway;
  children?: ReactNode;
}) {
  return (
    <PublishedContext.Provider value={gateway}>
      {children}
    </PublishedContext.Provider>
  );
}
export const usePublishedPolicyGateway = () => useContext(PublishedContext);
