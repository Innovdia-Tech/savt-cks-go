import type { ReactNode } from "react";
import { PolicyPreviewProvider } from "../preview-context";
import { draftPolicyPreview } from "./bundle";

export function PolicyPreviewBoundary({ children }: { children?: ReactNode }) {
  return (
    <PolicyPreviewProvider bundle={draftPolicyPreview}>
      {children}
    </PolicyPreviewProvider>
  );
}
