import type { BootstrapData } from "../api/contracts";

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

export type BridgeFailureKind = "unavailable" | "invalid" | "timeout";

export class BridgeError extends Error {
  constructor(readonly kind: BridgeFailureKind) {
    super(kind);
    this.name = "BridgeError";
  }
}

export interface NativeBridgePort {
  requestLaunchCode(bootstrap: BootstrapMessage): Promise<HandoffDetail>;
  notifyLoaded(): void;
  notifyError(code: string): void;
}

export interface BridgeEnvironment {
  channel?: { postMessage(message: string): void };
  addHandoffListener(listener: (detail: unknown) => void): void;
  removeHandoffListener(listener: (detail: unknown) => void): void;
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
  };
};

export class FlutterBridgeAdapter implements NativeBridgePort {
  private readonly attemptedRequestIds = new Set<string>();

  constructor(
    private readonly environment: BridgeEnvironment = browserBridgeEnvironment(),
    private readonly timeoutMs = 20_000,
  ) {}

  requestLaunchCode(bootstrap: BootstrapMessage): Promise<HandoffDetail> {
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
      const timer = setTimeout(
        () => finish(() => reject(new BridgeError("timeout"))),
        this.timeoutMs,
      );
      this.environment.addHandoffListener(onHandoff);
      try {
        this.environment.channel?.postMessage(
          JSON.stringify({ type: "bootstrap", payload: bootstrap }),
        );
      } catch {
        finish(() => reject(new BridgeError("unavailable")));
      }
    });
  }

  notifyLoaded(): void {
    this.post({ type: "loaded" });
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

export class DevelopmentBridgeAdapter implements NativeBridgePort {
  private readonly attemptedRequestIds = new Set<string>();

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

  notifyLoaded(): void {}

  notifyError(): void {}
}
