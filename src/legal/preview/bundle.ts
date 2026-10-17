import source from "./CKSGO_LEGAL_POLICY_PREVIEW_v01.json";
import type { PolicyKind } from "../contracts";
import type { DraftPolicyBundle } from "../preview-context";

// Import this module only from the restricted preview entry or fixture tests.
// It deliberately cannot create published records or acceptance requirements.
function policyKind(id: string): PolicyKind {
  switch (id) {
    case "terms":
    case "delivery":
    case "privacy":
      return id;
    case "refund":
      return "cancellation-refund";
    default:
      throw new Error("Unknown preview policy identifier");
  }
}

if (source.status !== "DRAFT_PREVIEW_ONLY" || source.effectiveDate !== null) {
  throw new Error("Expected an unpublished draft preview bundle");
}

export const draftPolicyPreview: DraftPolicyBundle = {
  status: "DRAFT_PREVIEW_ONLY",
  effectiveDate: null,
  policies: source.policies.map(({ id, title, subtitle, time, sections }) => ({
    kind: policyKind(id),
    title,
    subtitle,
    time,
    sections,
  })),
};
