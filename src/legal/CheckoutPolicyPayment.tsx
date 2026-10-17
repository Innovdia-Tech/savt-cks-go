import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PolicyAcceptanceController } from "./state";
import { POLICY_TITLES, type PolicyKind } from "./contracts";
import { PolicyCentre, PolicyEntry } from "./PolicyCentre";
import { usePolicyGateway } from "./context";
import { usePolicyPreview } from "./preview-context";
import "./checkout-policy.css";

// Checkout owns this pre-payment gate; provider, payment/retry and host bridge
// implementations remain unchanged. The backend must enforce the same gate.
export function CheckoutPolicyPayment({
  quoteId,
  acceptedTotalMinor,
  onInitiate,
  retryingInitiation = false,
}: {
  quoteId: string;
  acceptedTotalMinor?: number;
  onInitiate: () => Promise<unknown>;
  retryingInitiation?: boolean;
}) {
  const gateway = usePolicyGateway();
  const preview = usePolicyPreview();
  const controller = useMemo(
    () => new PolicyAcceptanceController(quoteId, gateway),
    [quoteId, gateway],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [reading, setReading] = useState<PolicyKind | "centre" | null>(null);
  const firstPolicy = useRef<HTMLButtonElement>(null);
  const [proceeding, setProceeding] = useState(false);
  const inFlight = useRef(false);
  const checkboxId = useId();
  const statusId = useId();
  useEffect(() => {
    controller.resume();
    void controller.load();
    return () => controller.dispose();
  }, [controller]);
  const proceed = async () => {
    if (preview || inFlight.current || !controller.getSnapshot().canProceed)
      return;
    inFlight.current = true;
    setProceeding(true);
    try {
      if (await controller.authorizeProceed()) await onInitiate();
    } finally {
      inFlight.current = false;
      setProceeding(false);
    }
  };
  const inactive = state.phase === "inactive";
  const required =
    state.requirement?.mode === "required" ? state.requirement : null;
  const busy =
    state.phase === "loading" || state.phase === "recording" || proceeding;
  return (
    <section
      className="payment-card legal-checkout"
      aria-label="Secure checkout"
    >
      <p className="quote-eyebrow">Secure checkout with Savt</p>
      {retryingInitiation ? (
        <p role="alert">
          We couldn’t confirm the payment request. Your basket is saved.
        </p>
      ) : (
        <p className="payment-final-notice">
          Please check your items and delivery address before paying.
          <br />
          Once confirmed, orders cannot be changed or cancelled in the app.
        </p>
      )}
      {!required && (
        <div className="legal-checkout__overview">
          <PolicyEntry
            open={reading === "centre"}
            onOpen={() => setReading("centre")}
          />
          <p>
            {preview
              ? "Shopping, delivery, refunds and privacy—explained clearly."
              : gateway
                ? "View available policies."
                : "Policies are not available yet."}
          </p>
        </div>
      )}
      {required && (
        <div className="legal-checkout__links" aria-label="Checkout policies">
          {required.policies.map(({ kind }, index) => (
            <button
              key={kind}
              ref={index === 0 ? firstPolicy : undefined}
              type="button"
              onClick={() => setReading(kind)}
            >
              {POLICY_TITLES[kind]}
            </button>
          ))}
        </div>
      )}
      {!inactive && (
        <div
          className={
            required ? "legal-checkout__agreement" : "legal-checkout__status"
          }
        >
          {required && (
            <label htmlFor={checkboxId}>
              <input
                id={checkboxId}
                type="checkbox"
                checked={state.checked}
                disabled={
                  inactive ||
                  state.phase === "loading" ||
                  state.phase === "error" ||
                  proceeding
                }
                aria-describedby={statusId}
                onChange={(event) =>
                  void controller.setChecked(event.target.checked)
                }
              />
              <span>
                I agree to the Terms &amp; Conditions, Delivery Policy and
                Cancellation &amp; Refund Policy, and acknowledge the Privacy
                Notice.
              </span>
            </label>
          )}
          <p id={statusId} role={state.error ? "alert" : "status"}>
            {state.error
              ? required
                ? "We couldn’t confirm your policy agreement. Please try again."
                : "We couldn’t check the policies for this order. Please try again."
              : state.phase === "loading"
                ? "Checking the policies for this order…"
                : state.phase === "recording"
                  ? "Saving your agreement…"
                  : state.phase === "accepted"
                    ? "Your agreement has been recorded for this checkout."
                    : "Read the policies and tick the box to continue."}
          </p>
          {state.error && (
            <button
              type="button"
              className="customer-button"
              disabled={busy}
              onClick={() => void controller.load()}
            >
              Try again
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        className="customer-button customer-primary payment-action"
        disabled={Boolean(preview) || !state.canProceed || busy}
        aria-busy={proceeding || undefined}
        onClick={() => void proceed()}
      >
        Proceed to Payment
        {acceptedTotalMinor !== undefined && (
          <span>
            {" "}
            ·{" "}
            {new Intl.NumberFormat("en-MY", {
              style: "currency",
              currency: "MYR",
            }).format(acceptedTotalMinor / 100)}
          </span>
        )}
      </button>
      {preview && (
        <p className="legal-checkout__preview-note">
          Payments are disabled in this restricted preview.
        </p>
      )}
      {reading && (
        <PolicyCentre
          gateway={gateway}
          initialPolicy={reading === "centre" ? undefined : reading}
          policies={
            state.requirement?.mode === "required"
              ? state.requirement.policies
              : undefined
          }
          returnLabel="Return to checkout"
          fallbackFocus={firstPolicy}
          onClose={() => setReading(null)}
        />
      )}
    </section>
  );
}
