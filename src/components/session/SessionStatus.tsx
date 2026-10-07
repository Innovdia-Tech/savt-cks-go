import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  type CustomerSessionController,
  type CustomerSessionState,
} from "../../session/controller";
import { CksGoLogo } from "../CksGoLogo";

type SessionPhase = CustomerSessionState["phase"];
type OtpPhase =
  | "awaitingMobile"
  | "requestingOtp"
  | "awaitingOtp"
  | "verifyingOtp"
  | "pilotDenied";

const presentations: Record<
  Exclude<SessionPhase, "authenticated" | OtpPhase>,
  { title: string; detail: string; canRetry: boolean }
> = {
  loading: {
    title: "Getting CKS Go ready…",
    detail: "",
    canRetry: false,
  },
  bridgeUnavailable: {
    title: "Open CKS Go from Savt",
    detail: "Return to Savt and open CKS Go again.",
    canRetry: true,
  },
  offline: {
    title: "You’re offline",
    detail: "Check your connection, then try again.",
    canRetry: true,
  },
  expired: {
    title: "Your Savt session has expired",
    detail: "Please return to Savt and sign in again.",
    canRetry: true,
  },
  retryableError: {
    title: "CKS Go is temporarily unavailable",
    detail: "Your session was not opened. Please try again.",
    canRetry: true,
  },
  unrecoverableError: {
    title: "Unable to open CKS Go",
    detail: "Return to Savt and open CKS Go again.",
    canRetry: false,
  },
};

export const sessionPresentation = (state: {
  phase: Exclude<SessionPhase, "authenticated" | OtpPhase>;
}) => presentations[state.phase];

const otpErrorMessage = (error: string | undefined): string | undefined => {
  switch (error) {
    case "invalidMobile":
      return "Enter a valid Malaysian mobile number.";
    case "invalidCode":
      return "Enter the six-digit code.";
    case "invalid":
      return "That code is invalid or has expired. Request a new code and try again.";
    case "rateLimited":
      return "Please wait before trying again.";
    case "unavailable":
      return "Verification is temporarily unavailable. Please try again.";
    default:
      return undefined;
  }
};

export function WebOtpEntry({
  controller,
  state,
}: {
  controller: CustomerSessionController;
  state: CustomerSessionState;
}) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [, refreshClock] = useState(0);
  const remaining = controller.resendRemainingSeconds();
  const retryRemaining = controller.retryRemainingSeconds();
  const isMobile =
    state.phase === "awaitingMobile" ||
    (state.phase === "requestingOtp" && !state.resending);
  const isOtp =
    state.phase === "awaitingOtp" ||
    state.phase === "verifyingOtp" ||
    (state.phase === "requestingOtp" && state.resending);
  const busy =
    state.phase === "requestingOtp" || state.phase === "verifyingOtp";
  const error = "error" in state ? otpErrorMessage(state.error) : undefined;

  useEffect(() => {
    if (!isOtp && state.phase !== "awaitingMobile") return;
    const timer = window.setInterval(
      () => refreshClock((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [
    controller,
    isOtp,
    state.phase,
    state.phase === "awaitingOtp" ? state.resendAfterSeconds : undefined,
  ]);

  const submitMobile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy && retryRemaining === 0) void controller.requestOtp(mobile);
  };
  const submitOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy && retryRemaining === 0) {
      const value = otp;
      setOtp("");
      void controller.verifyOtp(value);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-app-background px-4 py-8 text-savt-ink">
      <section className="w-full max-w-[390px] rounded-[32px] border border-white/80 bg-white p-6 shadow-lift sm:p-7">
        <CksGoLogo className="cks-go-logo--entry mx-auto" />
        <p className="mt-4 text-center text-xs font-semibold text-cks-primary">
          CKS Go
        </p>
        {state.phase === "pilotDenied" ? (
          <>
            <h1 className="mt-3 text-center text-xl font-bold text-slate-950">
              CKS Go is not available for this account yet.
            </h1>
            <p className="mt-3 text-center text-sm leading-6 text-slate-600">
              This service is currently available to selected members. Please
              contact Savt support if you need help.
            </p>
          </>
        ) : isMobile ? (
          <>
            <h1 className="mt-3 text-center text-xl font-bold text-slate-950">
              Sign in with your Savt account
            </h1>
            <p className="mt-2 text-center text-sm leading-6 text-slate-600">
              Enter your Malaysian mobile number to receive a one-time code.
            </p>
            <form className="mt-6 space-y-4" onSubmit={submitMobile} noValidate>
              <div>
                <label
                  htmlFor="cks-mobile"
                  className="block text-sm font-bold text-slate-950"
                >
                  Mobile number
                </label>
                <input
                  id="cks-mobile"
                  name="mobileNumber"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "cks-otp-error" : "cks-mobile-help"}
                  placeholder="012 345 6789"
                  className="mt-2 min-h-12 w-full rounded-control border border-slate-300 bg-white px-4 text-base text-slate-950"
                />
                <p id="cks-mobile-help" className="mt-2 text-xs text-slate-500">
                  Use the number registered with your Savt account.
                </p>
              </div>
              {error && (
                <p
                  id="cks-otp-error"
                  role="alert"
                  className="rounded-control bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  {error}
                  {retryRemaining > 0 ? ` ${retryRemaining}s remaining.` : ""}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || retryRemaining > 0}
                className="ui-button ui-button--primary w-full"
              >
                {busy ? "Sending code…" : "Send OTP"}
              </button>
            </form>
          </>
        ) : isOtp ? (
          <>
            <h1 className="mt-3 text-center text-xl font-bold text-slate-950">
              Verify your mobile number
            </h1>
            <p className="mt-2 text-center text-sm leading-6 text-slate-600">
              We sent a 6-digit verification code.
            </p>
            <form className="mt-6 space-y-4" onSubmit={submitOtp} noValidate>
              <div>
                <label
                  htmlFor="cks-otp"
                  className="block text-sm font-bold text-slate-950"
                >
                  One-time code
                </label>
                <input
                  id="cks-otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={busy}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "cks-otp-error" : undefined}
                  className="mt-2 min-h-12 w-full rounded-control border border-slate-300 bg-white px-4 text-center text-xl font-bold tracking-[0.35em] text-slate-950"
                />
              </div>
              {error && (
                <p
                  id="cks-otp-error"
                  role="alert"
                  className="rounded-control bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || retryRemaining > 0 || otp.length !== 6}
                className="ui-button ui-button--primary w-full"
              >
                {state.phase === "verifyingOtp"
                  ? "Verifying…"
                  : "Verify & continue"}
              </button>
            </form>
            <div className="mt-5 text-center text-sm text-slate-600">
              <p>Didn't receive it?</p>
              {remaining > 0 ? (
                <p role="status">
                  Resend code in{" "}
                  {String(Math.floor((remaining - 1) / 60)).padStart(2, "0")}:
                  {String(((remaining - 1) % 60) + 1).padStart(2, "0")}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void controller.resendOtp()}
                  className="min-h-11 font-bold text-cks-primary"
                >
                  Resend code
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void controller.retry()}
              className="mt-3 min-h-11 w-full text-center text-sm font-bold text-slate-600"
            >
              Use a different number
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

export function CustomerSessionBoundary({
  controller,
  children,
  embeddedHost = false,
}: {
  controller: CustomerSessionController;
  children: ReactNode;
  embeddedHost?: boolean;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    void controller.start();
  }, [controller]);

  if (state.phase === "authenticated") return children;
  if (
    state.phase === "awaitingMobile" ||
    state.phase === "requestingOtp" ||
    state.phase === "awaitingOtp" ||
    state.phase === "verifyingOtp" ||
    state.phase === "pilotDenied"
  )
    return <WebOtpEntry controller={controller} state={state} />;
  const presentation = sessionPresentation(state);
  const loading = state.phase === "loading";
  const requestId = "requestId" in state ? state.requestId : undefined;

  if (loading) return embeddedHost ? null : <StoreLoading />;

  return (
    <main className="grid min-h-dvh place-items-center bg-app-background px-5 text-savt-ink">
      <section className="w-full max-w-[390px] rounded-[32px] border border-white/80 bg-white p-7 text-center shadow-lift">
        <div
          className={`mx-auto grid h-16 w-16 place-items-center rounded-[24px] ${
            loading ? "bg-cks-soft text-cks-primary" : "bg-slate-100"
          }`}
          aria-hidden="true"
        >
          {loading ? (
            <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-cks-soft border-t-cks-primary" />
          ) : (
            <span className="text-2xl">!</span>
          )}
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-950">
          {presentation.title}
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {presentation.detail}
        </p>
        {requestId && (
          <p className="mt-3 text-xs font-medium text-slate-400">
            Reference: {requestId}
          </p>
        )}
        {presentation.canRetry ? (
          <button
            type="button"
            onClick={() => void controller.retry()}
            className="mt-6 min-h-12 w-full rounded-control bg-cks-primary px-5 text-sm font-semibold text-white shadow-button"
          >
            Try again
          </button>
        ) : !loading ? (
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-6 min-h-12 w-full rounded-[18px] bg-cks-primary px-5 text-sm font-semibold text-white"
          >
            Back to Savt
          </button>
        ) : null}
      </section>
    </main>
  );
}

export function StoreLoading() {
  return (
    <main
      className="delivery-setup delivery-setup--center"
      role="status"
      aria-busy="true"
    >
      <CksGoLogo />
      <div className="delivery-setup__spinner" aria-hidden="true" />
      <h1>Getting CKS Go ready…</h1>
    </main>
  );
}
