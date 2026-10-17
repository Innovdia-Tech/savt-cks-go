import { createContext, useContext, type ReactNode } from "react";
import type { PolicyKind } from "./contracts";

export type DraftPolicy = {
  kind: PolicyKind;
  title: string;
  subtitle: string;
  time: string;
  sections: readonly {
    heading: string;
    paragraphs: readonly string[];
  }[];
};

export type DraftPolicyBundle = {
  status: "DRAFT_PREVIEW_ONLY";
  effectiveDate: null;
  policies: readonly DraftPolicy[];
};

// This view-only seam contains no fixture import or policy gateway. The normal
// application has no draft data; a restricted preview entry may supply it.
const Context = createContext<DraftPolicyBundle | undefined>(undefined);

export function PolicyPreviewProvider({
  bundle,
  children,
}: {
  bundle: DraftPolicyBundle;
  children?: ReactNode;
}) {
  return <Context.Provider value={bundle}>{children}</Context.Provider>;
}

export const usePolicyPreview = () => useContext(Context);
