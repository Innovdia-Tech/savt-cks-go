import { describe, expect, it } from "vitest";
import { sessionPresentation } from "./SessionStatus";

describe("sessionPresentation", () => {
  it.each([
    ["loading", "Preparing CKS Go", false],
    ["bridgeUnavailable", "Open CKS Go from Savt", true],
    ["offline", "You’re offline", true],
    ["expired", "Your session has expired", true],
    ["retryableError", "CKS Go is temporarily unavailable", true],
    ["unrecoverableError", "Unable to open CKS Go", false],
  ] as const)("renders an explicit %s state", (phase, title, canRetry) => {
    expect(sessionPresentation({ phase })).toMatchObject({ title, canRetry });
  });
});
