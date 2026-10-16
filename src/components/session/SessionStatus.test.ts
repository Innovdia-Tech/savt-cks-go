import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type {
  CustomerSessionController,
  CustomerSessionState,
} from "../../session/controller";
import {
  CustomerSessionBoundary,
  sessionPresentation,
  WebOtpEntry,
} from "./SessionStatus";

describe("sessionPresentation", () => {
  it.each([
    ["loading", "Getting CKS Go ready…", false],
    ["bridgeUnavailable", "Open CKS Go from Savt", true],
    ["offline", "You’re offline", true],
    ["expired", "Your Savt session has expired", true],
    ["retryableError", "CKS Go is temporarily unavailable", true],
    ["unrecoverableError", "Unable to open CKS Go", false],
    ["browserUnavailable", "Open CKS Go from the Savt QA app", true],
  ] as const)("renders an explicit %s state", (phase, title, canRetry) => {
    expect(sessionPresentation({ phase })).toMatchObject({ title, canRetry });
  });
});

describe("standalone OTP entry", () => {
  const render = (state: CustomerSessionState) =>
    renderToStaticMarkup(
      createElement(WebOtpEntry, {
        state,
        controller: {
          resendRemainingSeconds: () => 60,
          retryRemainingSeconds: () => 0,
        } as CustomerSessionController,
      }),
    );

  it("shows an accessible mobile form without a native bridge instruction", () => {
    const html = render({ phase: "awaitingMobile" });
    expect(html).toContain("Mobile number");
    expect(html).toContain('type="tel"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain("Send OTP");
    expect(html).not.toContain("Open CKS Go from Savt");
  });

  it("shows six-digit OTP entry, resend countdown and safe invalid-code feedback", () => {
    const html = render({
      phase: "awaitingOtp",
      resendAfterSeconds: 60,
      error: "invalid",
    });
    expect(html).toContain("Verify your mobile number");
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('maxLength="6"');
    expect(html).toContain("Resend code in 00:60");
    expect(html).toContain("Use a different number");
    expect(html).toContain("That code is invalid or has expired");
    expect(html).not.toContain("+601100000001");
  });

  it("shows a safe pilot access state", () => {
    const html = render({ phase: "pilotDenied" });
    expect(html).toContain("CKS Go is not available for this account yet.");
    expect(html).not.toContain("memberId");
  });

  it.each([
    ["rateLimited", "Please wait before trying again."],
    [
      "unavailable",
      "Verification is temporarily unavailable. Please try again.",
    ],
  ] as const)("renders safe %s feedback", (error, copy) => {
    const html = render({
      phase: "awaitingOtp",
      resendAfterSeconds: 60,
      error,
    });
    expect(html).toContain(copy);
    expect(html).not.toContain("private upstream detail");
  });

  it("keeps form controls and card within a narrow mobile viewport", () => {
    const html = render({ phase: "awaitingMobile" });
    expect(html).toContain("px-4");
    expect(html).toContain("max-w-[390px]");
    expect(html).toContain('type="submit"');
    expect(html).toContain('noValidate=""');
  });
});

describe("embedded session boundary", () => {
  const render = (state: CustomerSessionState, embeddedHost = true) =>
    renderToStaticMarkup(
      createElement(CustomerSessionBoundary, {
        controller: {
          getSnapshot: () => state,
          subscribe: () => () => {},
        } as unknown as CustomerSessionController,
        embeddedHost,
        children: createElement("section", null, "Authenticated Home"),
      }),
    );

  it("leaves embedded startup presentation to native without exposing Home", () => {
    expect(render({ phase: "loading" })).toBe("");
    expect(render({ phase: "loading" }, false)).toContain(
      "Getting CKS Go ready…",
    );
  });

  it("allows Home only after authentication", () => {
    expect(
      render({ phase: "authenticated", expiresAt: "2099-01-01T00:00:00Z" }),
    ).toContain("Authenticated Home");
    expect(render({ phase: "expired" })).not.toContain("Authenticated Home");
  });

  it("retains genuine embedded error and retry presentation", () => {
    const html = render({ phase: "offline" });
    expect(html).toContain("You’re offline");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Authenticated Home");
  });

  it.each(["checking", "authorizing", "offline"] as const)(
    "keeps retained Home inaccessible without removing layout during %s",
    (recovery) => {
      const html = render({
        phase: "authenticated",
        expiresAt: "2099-01-01T00:00:00Z",
        recovery,
      });
      expect(html).toContain("Authenticated Home");
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('inert=""');
      expect(html).not.toContain('hidden=""');
      expect(html).toContain("Your Basket and payment state are kept");
    },
  );

  it.each(["failed", "signIn"] as const)(
    "keeps retained Home hidden after %s recovery",
    (recovery) => {
      const html = render({
        phase: "authenticated",
        expiresAt: "2099-01-01T00:00:00Z",
        recovery,
      });
      expect(html).toContain("Authenticated Home");
      expect(html).toContain('hidden=""');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('inert=""');
    },
  );

  it("offers secure retry after service failure and explains the existing native return action without claiming durable basket storage", () => {
    const html = render({
      phase: "authenticated",
      expiresAt: "2099-01-01T00:00:00Z",
      recovery: "failed",
      manualRecovery: true,
      canRetryRecovery: true,
    });
    expect(html).toContain("Retry securely");
    expect(html).toContain("Return to Savt");
    expect(html).toContain("close button");
    expect(html).not.toContain("Closing CKS Go will discard this Basket");
    expect(html).toContain("No payment is retried");
  });

  it("does not show a mobile-number form when QA browser sign-in is disabled", () => {
    const html = render(
      { phase: "browserUnavailable", reason: "disabled" },
      false,
    );
    expect(html).toContain(
      "Browser sign-in is disabled in this QA environment",
    );
    expect(html).toContain("Check access again");
    expect(html).not.toContain("Send OTP");
    expect(html).not.toContain('type="tel"');
  });
});
