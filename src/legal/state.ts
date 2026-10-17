import {
  parseReceipt,
  parseRequirement,
  type AcceptanceRequest,
  type PolicyGateway,
  type Receipt,
  type Requirement,
  type RequiredRequirement,
} from "./contracts";

export type PolicyAcceptanceSnapshot = {
  phase:
    "inactive" | "loading" | "unchecked" | "recording" | "accepted" | "error";
  checked: boolean;
  requirement: Requirement | null;
  receipt: Receipt | null;
  error: string | null;
  canProceed: boolean;
};
export class PolicyAcceptanceController {
  private state: PolicyAcceptanceSnapshot;
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private abort?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private recording?: Promise<void>;
  private disposed = false;
  private enforcementSeen = false;

  constructor(
    private readonly quoteId: string,
    private readonly gateway?: PolicyGateway,
    private readonly now = Date.now,
  ) {
    this.state = {
      phase: gateway ? "loading" : "inactive",
      checked: false,
      requirement: null,
      receipt: null,
      error: null,
      canProceed: !gateway,
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = (): PolicyAcceptanceSnapshot => this.state;

  private cancel() {
    this.generation += 1;
    this.abort?.abort();
    this.abort = undefined;
    this.recording = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private begin() {
    this.cancel();
    const abort = new AbortController();
    this.abort = abort;
    return { generation: this.generation, signal: abort.signal };
  }

  private current(operation: { generation: number; signal: AbortSignal }) {
    return (
      !this.disposed &&
      !operation.signal.aborted &&
      operation.generation === this.generation
    );
  }

  private update(patch: Partial<PolicyAcceptanceSnapshot>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    clearTimeout(this.timer);
    this.timer = undefined;
    const required = this.state.requirement;
    if (required?.mode === "required") {
      const expires = Math.min(
        Date.parse(required.expiresAt),
        this.state.receipt
          ? Date.parse(this.state.receipt.expiresAt)
          : Infinity,
      );
      const remaining = expires - this.now();
      if (remaining > 0) {
        this.timer = setTimeout(
          () => {
            if (expires <= this.now()) {
              this.cancel();
              this.update({
                phase: "unchecked",
                checked: false,
                receipt: null,
                canProceed: false,
                error:
                  "Policy acceptance expired. Reload policies before continuing.",
              });
            } else {
              this.update({});
            }
          },
          Math.min(remaining, 2_147_483_647),
        );
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  private failure() {
    this.cancel();
    this.update({
      phase: "error",
      checked: false,
      receipt: null,
      canProceed: false,
      error: "Unable to verify the current policies. Please try again.",
    });
  }

  private parseCurrent(value: unknown): Requirement {
    // A malformed required response still must not become a later downgrade.
    if (
      value &&
      typeof value === "object" &&
      "mode" in value &&
      value.mode === "required"
    )
      this.enforcementSeen = true;
    const required = parseRequirement(value, this.quoteId, this.now());
    if (required.mode === "inactive" && this.enforcementSeen)
      throw new Error("Policy enforcement cannot be downgraded");
    return required;
  }

  async load(): Promise<void> {
    if (this.disposed || !this.gateway) return;
    const previous = this.state;
    const operation = this.begin();
    this.update({
      phase: "loading",
      checked: false,
      receipt: null,
      canProceed: false,
      error: null,
    });
    try {
      const raw = await boundedRequest(operation.signal, () =>
        this.gateway!.checkoutRequirement(this.quoteId, operation.signal),
      );
      if (!this.current(operation)) return;
      const required = this.parseCurrent(raw);
      if (required.mode === "inactive") {
        this.update({
          phase: "inactive",
          requirement: required,
          canProceed: true,
        });
        return;
      }
      const saved = this.validConsent(previous, required);
      this.update({
        phase: saved ? "accepted" : "unchecked",
        requirement: required,
        receipt: saved,
        checked: !!saved,
        canProceed: !!saved,
      });
    } catch {
      if (this.current(operation)) this.failure();
    }
  }

  async setChecked(checked: boolean): Promise<void> {
    if (this.disposed || !this.gateway) return;
    if (!checked) {
      this.cancel();
      const inactive =
        this.state.requirement?.mode === "inactive" && !this.enforcementSeen;
      this.update({
        phase: inactive ? "inactive" : "unchecked",
        checked: false,
        receipt: null,
        canProceed: inactive,
        error: null,
      });
      return;
    }
    if (this.recording) return this.recording;
    const required = this.state.requirement;
    if (required?.mode !== "required" || this.state.phase === "loading") return;
    if (Date.parse(required.expiresAt) <= this.now()) {
      this.failure();
      return;
    }
    if (this.validConsent(this.state, required)) return;
    const operation = this.begin();
    const request: AcceptanceRequest = {
      quoteId: required.quoteId,
      checkoutAttemptId: required.checkoutAttemptId,
      requirementId: required.requirementId,
      accepted: true,
      policies: required.policies.map(({ kind, version }) => ({
        kind,
        version,
      })),
    };
    this.update({
      phase: "recording",
      checked: true,
      receipt: null,
      canProceed: false,
      error: null,
    });
    const recording = (async () => {
      try {
        const raw = await boundedRequest(operation.signal, () =>
          this.gateway!.recordAcceptance(request, operation.signal),
        );
        if (!this.current(operation)) return;
        const saved = parseReceipt(raw, required, this.now());
        this.update({
          phase: "accepted",
          checked: true,
          receipt: saved,
          canProceed: true,
        });
      } catch {
        if (this.current(operation)) this.failure();
      } finally {
        if (this.current(operation)) this.recording = undefined;
      }
    })();
    this.recording = recording;
    return recording;
  }

  private validConsent(
    previous: PolicyAcceptanceSnapshot,
    required: RequiredRequirement,
  ): Receipt | null {
    if (
      !previous.checked ||
      !previous.receipt ||
      previous.requirement?.mode !== "required" ||
      !sameRequirement(previous.requirement, required)
    )
      return null;
    try {
      return parseReceipt(previous.receipt, required, this.now());
    } catch {
      return null;
    }
  }

  async authorizeProceed(): Promise<boolean> {
    if (this.disposed) return false;
    if (!this.gateway) return true;
    const previous = this.state;
    const operation = this.begin();
    this.update({
      phase: "loading",
      checked: false,
      receipt: null,
      canProceed: false,
      error: null,
    });
    try {
      const raw = await boundedRequest(operation.signal, () =>
        this.gateway!.checkoutRequirement(this.quoteId, operation.signal),
      );
      if (!this.current(operation)) return false;
      const required = this.parseCurrent(raw);
      if (required.mode === "inactive") {
        this.update({
          phase: "inactive",
          requirement: required,
          canProceed: true,
        });
        return true;
      }
      const saved = this.validConsent(previous, required);
      this.update({
        phase: saved ? "accepted" : "unchecked",
        requirement: required,
        checked: !!saved,
        receipt: saved,
        canProceed: !!saved,
        error: saved
          ? null
          : "Review and accept the current policies before continuing.",
      });
      return !!saved;
    } catch {
      if (this.current(operation)) this.failure();
      return false;
    }
  }

  dispose() {
    this.cancel();
    this.disposed = true;
    this.state = {
      ...this.state,
      checked: false,
      receipt: null,
      canProceed: false,
    };
    this.listeners.clear();
  }

  // React StrictMode may set up an effect again after its cleanup. A resumed
  // lifecycle always reloads requirements and never restores accepted consent.
  resume() {
    if (!this.disposed) return;
    this.disposed = false;
    this.update({
      phase: this.gateway ? "loading" : "inactive",
      checked: false,
      requirement: null,
      receipt: null,
      error: null,
      canProceed: !this.gateway,
    });
  }
}

async function boundedRequest(
  signal: AbortSignal,
  request: () => Promise<unknown>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let aborted: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    aborted = () => reject(new Error("Policy request aborted"));
    signal.addEventListener("abort", aborted, { once: true });
    timer = setTimeout(
      () => reject(new Error("Policy request timed out")),
      15_000,
    );
  });
  try {
    if (signal.aborted) throw new Error("Policy request aborted");
    return await Promise.race([request(), interrupted]);
  } finally {
    clearTimeout(timer);
    if (aborted) signal.removeEventListener("abort", aborted);
  }
}

function sameRequirement(
  left: RequiredRequirement,
  right: RequiredRequirement,
) {
  return (
    left.quoteId === right.quoteId &&
    left.checkoutAttemptId === right.checkoutAttemptId &&
    left.requirementId === right.requirementId &&
    left.expiresAt === right.expiresAt &&
    left.policies.length === right.policies.length &&
    left.policies.every((policy) =>
      right.policies.some(
        (other) =>
          policy.kind === other.kind &&
          policy.version === other.version &&
          policy.content === other.content &&
          policy.effectiveAt === other.effectiveAt &&
          policy.publishedAt === other.publishedAt,
      ),
    )
  );
}
