import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  type CustomerSessionController,
  type CustomerSessionState,
} from "../../session/controller";

type SessionPhase = CustomerSessionState["phase"];

const presentations: Record<
  Exclude<SessionPhase, "authenticated">,
  { title: string; detail: string; canRetry: boolean }
> = {
  loading: {
    title: "Preparing CKS Go",
    detail: "Securing your customer session…",
    canRetry: false,
  },
  bridgeUnavailable: {
    title: "Open CKS Go from Savt",
    detail: "The secure Savt handoff is not available in this browser.",
    canRetry: true,
  },
  offline: {
    title: "You’re offline",
    detail: "Check your connection, then try again.",
    canRetry: true,
  },
  expired: {
    title: "Your session has expired",
    detail: "Return to Savt or relaunch the secure customer session.",
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
  phase: Exclude<SessionPhase, "authenticated">;
}) => presentations[state.phase];

export function CustomerSessionBoundary({
  controller,
  children,
}: {
  controller: CustomerSessionController;
  children: ReactNode;
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
  const presentation = sessionPresentation(state);
  const loading = state.phase === "loading";
  const requestId = "requestId" in state ? state.requestId : undefined;

  return (
    <main className="grid min-h-dvh place-items-center bg-[#EAF2ED] px-5 text-savt-ink">
      <section className="w-full max-w-[390px] rounded-[32px] border border-white/80 bg-white p-7 text-center shadow-lift">
        <div
          className={`mx-auto grid h-16 w-16 place-items-center rounded-[24px] ${
            loading ? "bg-savt-light" : "bg-slate-100"
          }`}
          aria-hidden="true"
        >
          {loading ? (
            <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-emerald-200 border-t-savt-green" />
          ) : (
            <span className="text-2xl">!</span>
          )}
        </div>
        <h1 className="mt-5 text-2xl font-black text-slate-950">
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
            className="mt-6 min-h-12 w-full rounded-[18px] bg-savt-green px-5 text-sm font-black text-white shadow-button"
          >
            Try again
          </button>
        ) : !loading ? (
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-6 min-h-12 w-full rounded-[18px] bg-slate-950 px-5 text-sm font-black text-white"
          >
            Back to Savt
          </button>
        ) : null}
      </section>
    </main>
  );
}
