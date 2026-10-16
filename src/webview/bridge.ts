import type { BootstrapData } from "../api/contracts";
import { uuid } from "../customer/contracts";
import { isSafeCheckoutUrl } from "../payment/contracts";
import { isLocalPaymentSimulatorCheckoutUrl } from "../payment/local-simulator";

export type BootstrapMessage = Pick<
  BootstrapData,
  | "protocolVersion"
  | "launchRequestId"
  | "state"
  | "codeChallenge"
  | "codeChallengeMethod"
>;

export type HandoffDetail = {
  protocolVersion: "1";
  launchRequestId: string;
  state: string;
  code: string;
};

export type BridgeFailureKind =
  "unavailable" | "invalid" | "timeout" | "network" | "sign-in-required";

export class BridgeError extends Error {
  constructor(readonly kind: BridgeFailureKind) {
    super(kind);
    this.name = "BridgeError";
  }
}

export interface NativeBridgePort {
  requestLaunchCode(bootstrap: BootstrapMessage): Promise<HandoffDetail>;
  requestSessionRecovery?(options?: { retry?: true }): Promise<void>;
  notifySessionValidated?(nativeReady?: boolean): void;
  notifySessionRecoveryFailed?(code: "network" | "invalid-session"): void;
  verifySessionRecovery?(): void;
  requestPaymentHandoff(
    checkoutUrl: string,
    paymentIntentId: string,
  ): Promise<void>;
  clearPaymentRecovery?(paymentIntentId: string): void;
  notifyLoaded(): void;
  notifyError(code: string): void;
}

export interface BridgeEnvironment {
  channel?: { postMessage(message: string): void };
  addHandoffListener(listener: (detail: unknown) => void): void;
  removeHandoffListener(listener: (detail: unknown) => void): void;
  addSessionListener?(listener: (detail: unknown) => void): void;
  removeSessionListener?(listener: (detail: unknown) => void): void;
}

declare global {
  interface Window {
    SavtCksGoBridge?: { postMessage(message: string): void };
  }
}

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaque43 = /^[A-Za-z0-9_-]{43}$/;

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

const isHandoff = (value: unknown): value is HandoffDetail => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const detail = value as Record<string, unknown>;
  return (
    hasExactKeys(detail, [
      "protocolVersion",
      "launchRequestId",
      "state",
      "code",
    ]) &&
    detail.protocolVersion === "1" &&
    typeof detail.launchRequestId === "string" &&
    uuidV4.test(detail.launchRequestId) &&
    typeof detail.state === "string" &&
    opaque43.test(detail.state) &&
    typeof detail.code === "string" &&
    opaque43.test(detail.code)
  );
};

export const browserBridgeEnvironment = (): BridgeEnvironment => {
  const wrappers = new Map<(detail: unknown) => void, EventListener>();
  const sessionWrappers = new Map<(detail: unknown) => void, EventListener>();
  return {
    channel: window.SavtCksGoBridge,
    addHandoffListener(listener) {
      const wrapper: EventListener = (event) =>
        listener(event instanceof CustomEvent ? event.detail : undefined);
      wrappers.set(listener, wrapper);
      window.addEventListener("savt-cks-go-handoff", wrapper);
    },
    removeHandoffListener(listener) {
      const wrapper = wrappers.get(listener);
      if (wrapper) window.removeEventListener("savt-cks-go-handoff", wrapper);
      wrappers.delete(listener);
    },
    addSessionListener(listener) {
      const wrapper: EventListener = (event) =>
        listener(event instanceof CustomEvent ? event.detail : undefined);
      sessionWrappers.set(listener, wrapper);
      window.addEventListener("savt-cks-go-session", wrapper);
    },
    removeSessionListener(listener) {
      const wrapper = sessionWrappers.get(listener);
      if (wrapper) window.removeEventListener("savt-cks-go-session", wrapper);
      sessionWrappers.delete(listener);
    },
  };
};

export class FlutterBridgeAdapter implements NativeBridgePort {
  private readonly attemptedRequestIds = new Set<string>();
  private recoveryInFlight: Promise<void> | undefined;
  private recoveryRequestId: string | undefined;
  private recoveryEpisodeId: string | undefined;
  private recoveryError: BridgeError | undefined;
  private episodeListener: ((detail: unknown) => void) | undefined;

  constructor(
    private readonly environment: BridgeEnvironment = browserBridgeEnvironment(),
    private readonly timeoutMs = 20_000,
  ) {}

  requestSessionRecovery(options?: { retry?: true }): Promise<void> {
    if (this.recoveryInFlight) return this.recoveryInFlight;
    if (
      !this.environment.channel ||
      !this.environment.addSessionListener ||
      !this.environment.removeSessionListener
    )
      return Promise.reject(new BridgeError("unavailable"));
    const requestId = crypto.randomUUID();
    this.clearRecoveryListener();
    this.recoveryError = undefined;
    const episodeListener = (value: unknown) => {
      if (typeof value !== "object" || value === null) return;
      const message = value as Record<string, unknown>;
      if (
        !hasExactKeys(message, ["type", "requestId", "code"]) ||
        message.type !== "recovery-failed" ||
        message.requestId !== requestId
      )
        return;
      if (
        ["network", "sign-in-required", "invalid-session"].includes(
          String(message.code),
        )
      )
        this.recoveryError = new BridgeError(
          message.code === "invalid-session"
            ? "invalid"
            : (message.code as "network" | "sign-in-required"),
        );
    };
    const pending = new Promise<void>((resolve, reject) => {
      let settled = false;
      let reofferedOnResume = false;
      const postRequest = () =>
        this.environment.channel?.postMessage(
          JSON.stringify({
            type: "session-recovery-request",
            requestId,
            ...(options?.retry ? { retry: true } : {}),
          }),
        );
      const finish = (error?: BridgeError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.environment.removeSessionListener?.(listener);
        if (error) reject(error);
        else resolve();
      };
      const listener = (value: unknown) => {
        if (typeof value !== "object" || value === null) return;
        const message = value as Record<string, unknown>;
        if (message.type === "resume") {
          if (hasExactKeys(message, ["type"]) && !reofferedOnResume) {
            reofferedOnResume = true;
            try {
              postRequest();
            } catch {
              finish(new BridgeError("unavailable"));
            }
          }
          return;
        }
        if (
          hasExactKeys(message, ["type", "requestId", "code"]) &&
          message.type === "recovery-failed" &&
          message.requestId === requestId &&
          ["network", "sign-in-required", "invalid-session"].includes(
            String(message.code),
          )
        ) {
          this.recoveryEpisodeId = requestId;
          finish(
            new BridgeError(
              message.code === "invalid-session"
                ? "invalid"
                : (message.code as "network" | "sign-in-required"),
            ),
          );
          return;
        }
        if (
          hasExactKeys(message, ["type", "requestId"]) &&
          message.type === "recovery-granted" &&
          message.requestId === requestId
        ) {
          this.recoveryRequestId = requestId;
          this.recoveryEpisodeId = requestId;
          this.episodeListener = episodeListener;
          this.environment.addSessionListener?.(episodeListener);
          finish();
        }
      };
      const timer = setTimeout(
        () => finish(new BridgeError("timeout")),
        this.timeoutMs,
      );
      this.environment.addSessionListener?.(listener);
      try {
        postRequest();
      } catch {
        finish(new BridgeError("unavailable"));
      }
    }).finally(() => {
      if (this.recoveryInFlight === pending) this.recoveryInFlight = undefined;
    });
    this.recoveryInFlight = pending;
    return pending;
  }

  notifySessionValidated(nativeReady = false): void {
    // Older installed hosts have no session-event protocol. A valid-session
    // visibility check must not send them an unknown terminal bridge message.
    if (!nativeReady && !this.recoveryEpisodeId) return;
    try {
      this.environment.channel?.postMessage(
        JSON.stringify({ type: "session-validated" }),
      );
    } catch {
      /* no credentials */
    }
    this.recoveryEpisodeId = undefined;
    this.clearRecoveryListener();
    this.recoveryError = undefined;
  }

  notifySessionRecoveryFailed(code: "network" | "invalid-session"): void {
    if (!this.recoveryEpisodeId) return;
    try {
      this.environment.channel?.postMessage(
        JSON.stringify({
          type: "session-recovery-failed",
          requestId: this.recoveryEpisodeId,
          code,
        }),
      );
    } catch {
      /* keep state gated */
    }
  }

  verifySessionRecovery(): void {
    if (this.recoveryError) throw this.recoveryError;
  }

  private clearRecoveryListener(): void {
    if (this.episodeListener)
      this.environment.removeSessionListener?.(this.episodeListener);
    this.episodeListener = undefined;
  }

  requestLaunchCode(bootstrap: BootstrapMessage): Promise<HandoffDetail> {
    if (this.recoveryError) return Promise.reject(this.recoveryError);
    if (!this.environment.channel)
      return Promise.reject(new BridgeError("unavailable"));
    if (this.attemptedRequestIds.has(bootstrap.launchRequestId)) {
      return Promise.reject(new BridgeError("invalid"));
    }
    this.attemptedRequestIds.add(bootstrap.launchRequestId);

    return new Promise<HandoffDetail>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.environment.removeHandoffListener(onHandoff);
        this.environment.removeSessionListener?.(onRecoveryFailure);
        this.recoveryRequestId = undefined;
        action();
      };
      const onHandoff = (detail: unknown) => {
        if (
          !isHandoff(detail) ||
          detail.launchRequestId !== bootstrap.launchRequestId ||
          detail.state !== bootstrap.state
        ) {
          finish(() => reject(new BridgeError("invalid")));
          return;
        }
        finish(() => resolve(detail));
      };
      const onRecoveryFailure = (value: unknown) => {
        if (typeof value !== "object" || value === null) return;
        const message = value as Record<string, unknown>;
        if (
          !this.recoveryRequestId ||
          !hasExactKeys(message, ["type", "requestId", "code"]) ||
          message.type !== "recovery-failed" ||
          message.requestId !== this.recoveryRequestId ||
          !["network", "sign-in-required", "invalid-session"].includes(
            String(message.code),
          )
        )
          return;
        const kind =
          message.code === "network"
            ? "network"
            : message.code === "sign-in-required"
              ? "sign-in-required"
              : "invalid";
        finish(() => reject(new BridgeError(kind)));
      };
      const timer = setTimeout(
        () => finish(() => reject(new BridgeError("timeout"))),
        this.timeoutMs,
      );
      this.environment.addHandoffListener(onHandoff);
      if (this.recoveryRequestId)
        this.environment.addSessionListener?.(onRecoveryFailure);
      try {
        this.environment.channel?.postMessage(
          JSON.stringify({ type: "bootstrap", payload: bootstrap }),
        );
      } catch {
        finish(() => reject(new BridgeError("unavailable")));
      }
    });
  }

  async requestPaymentHandoff(
    checkoutUrl: string,
    paymentIntentId: string,
  ): Promise<void> {
    if (!isSafeCheckoutUrl(checkoutUrl) || !uuid(paymentIntentId))
      throw new BridgeError("invalid");
    if (!this.environment.channel) throw new BridgeError("unavailable");
    try {
      this.environment.channel.postMessage(
        JSON.stringify({
          type: "payment-handoff",
          payload: { checkoutUrl, paymentIntentId },
        }),
      );
    } catch {
      throw new BridgeError("unavailable");
    }
  }

  notifyLoaded(): void {
    this.post({ type: "loaded" });
    this.clearRecoveryListener();
  }

  clearPaymentRecovery(paymentIntentId: string): void {
    if (!uuid(paymentIntentId)) return;
    try {
      this.environment.channel?.postMessage(
        JSON.stringify({
          type: "payment-recovery-clear",
          payload: { paymentIntentId },
        }),
      );
    } catch {
      /* Recovery remains available if the native host is unavailable. */
    }
  }

  notifyError(code: string): void {
    const safeCode = /^[A-Z0-9_]{1,64}$/.test(code)
      ? code
      : "CUSTOMER_SESSION_ERROR";
    this.post({ type: "error", code: safeCode });
  }

  private post(
    message: { type: "loaded" } | { type: "error"; code: string },
  ): void {
    try {
      this.environment.channel?.postMessage(JSON.stringify(message));
    } catch {
      // Session UI already represents terminal bridge errors; no sensitive data is logged.
    }
  }
}

// Standalone browser entry keeps payment navigation behind the same validated
// handoff port while native authorization remains unavailable without Flutter.
export class BrowserBridgeAdapter implements NativeBridgePort {
  constructor(
    private readonly navigate: (url: string) => void = (url) =>
      window.location.assign(url),
  ) {}

  requestLaunchCode(_bootstrap: BootstrapMessage): Promise<HandoffDetail> {
    return Promise.reject(new BridgeError("unavailable"));
  }

  async requestPaymentHandoff(
    checkoutUrl: string,
    paymentIntentId: string,
  ): Promise<void> {
    if (!isSafeCheckoutUrl(checkoutUrl) || !uuid(paymentIntentId))
      throw new BridgeError("invalid");
    try {
      if (isLocalPaymentSimulatorCheckoutUrl(checkoutUrl)) {
        // noopener returns null even for an opened tab; only a thrown error is actionable.
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      } else {
        this.navigate(checkoutUrl);
      }
    } catch {
      throw new BridgeError("unavailable");
    }
  }

  notifyLoaded(): void {}
  clearPaymentRecovery(): void {}
  notifyError(): void {}
}

export class DevelopmentBridgeAdapter implements NativeBridgePort {
  private readonly attemptedRequestIds = new Set<string>();
  private readonly paymentHandoffs: string[] = [];
  private failNextPayment = false;

  constructor(
    private readonly enabled: boolean,
    private readonly production: boolean,
  ) {}

  async requestLaunchCode(bootstrap: BootstrapMessage): Promise<HandoffDetail> {
    if (!this.enabled || this.production) throw new BridgeError("unavailable");
    if (this.attemptedRequestIds.has(bootstrap.launchRequestId))
      throw new BridgeError("invalid");
    this.attemptedRequestIds.add(bootstrap.launchRequestId);
    return {
      protocolVersion: "1",
      launchRequestId: bootstrap.launchRequestId,
      state: bootstrap.state,
      code: "D".repeat(43),
    };
  }

  async requestPaymentHandoff(
    checkoutUrl: string,
    paymentIntentId: string,
  ): Promise<void> {
    if (!isSafeCheckoutUrl(checkoutUrl) || !uuid(paymentIntentId))
      throw new BridgeError("invalid");
    if (!this.enabled || this.production) throw new BridgeError("unavailable");
    if (this.failNextPayment) {
      this.failNextPayment = false;
      throw new BridgeError("unavailable");
    }
    this.paymentHandoffs.push(checkoutUrl);
  }

  failNextPaymentHandoff(): void {
    this.failNextPayment = true;
  }

  getPaymentHandoffs(): readonly string[] {
    return [...this.paymentHandoffs];
  }

  notifyLoaded(): void {}
  clearPaymentRecovery(): void {}

  notifyError(): void {}
}

export const selectCustomerBridge = (
  embeddedHost: boolean,
  developmentBridge: boolean,
  production: boolean,
): NativeBridgePort =>
  developmentBridge
    ? new DevelopmentBridgeAdapter(true, production)
    : embeddedHost
      ? new FlutterBridgeAdapter()
      : new BrowserBridgeAdapter();
