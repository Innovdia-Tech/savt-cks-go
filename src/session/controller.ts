import { ApiClientError, type CustomerApi } from "../api/client";
import type { SessionData } from "../api/contracts";
import { BridgeError, type NativeBridgePort } from "../webview/bridge";

export type CustomerSessionState =
  | { phase: "loading" }
  | { phase: "authenticated"; expiresAt: string }
  | { phase: "bridgeUnavailable" }
  | { phase: "offline" }
  | { phase: "expired" }
  | { phase: "retryableError"; requestId?: string }
  | { phase: "unrecoverableError"; requestId?: string };

type Listener = () => void;

export class CustomerSessionController {
  private state: CustomerSessionState = { phase: "loading" };
  private csrfToken: string | undefined;
  private readonly listeners = new Set<Listener>();
  private generation = 0;

  constructor(
    private readonly api: CustomerApi,
    private readonly bridge: NativeBridgePort,
  ) {}

  getSnapshot = (): CustomerSessionState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async start(): Promise<void> {
    const generation = ++this.generation;
    this.clearCredentials();
    this.transition({ phase: "loading" });
    try {
      const session = await this.api.status();
      if (generation !== this.generation) return;
      this.authenticate(session);
      return;
    } catch (error) {
      if (generation !== this.generation) return;
      if (!(error instanceof ApiClientError) || error.category !== "expired") {
        this.fail(error);
        return;
      }
    }

    try {
      const bootstrap = await this.api.bootstrap();
      if (generation !== this.generation) return;
      const handoff = await this.bridge.requestLaunchCode({
        protocolVersion: bootstrap.protocolVersion,
        launchRequestId: bootstrap.launchRequestId,
        state: bootstrap.state,
        codeChallenge: bootstrap.codeChallenge,
        codeChallengeMethod: bootstrap.codeChallengeMethod,
      });
      if (generation !== this.generation) return;
      const session = await this.api.exchange(handoff);
      if (generation !== this.generation) return;
      this.authenticate(session);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  retry(): Promise<void> {
    return this.start();
  }

  async logout(): Promise<void> {
    const generation = ++this.generation;
    const csrfToken = this.csrfToken;
    this.clearCredentials();
    this.transition({ phase: "loading" });
    try {
      if (csrfToken) await this.api.logout(csrfToken);
      if (generation === this.generation) this.transition({ phase: "expired" });
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  private authenticate(session: SessionData): void {
    this.csrfToken = session.csrfToken;
    this.transition({ phase: "authenticated", expiresAt: session.expiresAt });
    this.bridge.notifyLoaded();
  }

  private clearCredentials(): void {
    this.csrfToken = undefined;
  }

  private fail(error: unknown): void {
    this.clearCredentials();
    if (error instanceof BridgeError) {
      const phase =
        error.kind === "unavailable" ? "bridgeUnavailable" : "retryableError";
      this.transition({ phase });
      this.bridge.notifyError(
        error.kind === "timeout" ? "BRIDGE_TIMEOUT" : "BRIDGE_INVALID",
      );
      return;
    }
    if (error instanceof ApiClientError) {
      if (error.category === "offline") this.transition({ phase: "offline" });
      else if (error.category === "expired")
        this.transition({ phase: "expired" });
      else if (error.category === "retryable") {
        this.transition({
          phase: "retryableError",
          ...(error.requestId ? { requestId: error.requestId } : {}),
        });
      } else {
        this.transition({
          phase: "unrecoverableError",
          ...(error.requestId ? { requestId: error.requestId } : {}),
        });
      }
      this.bridge.notifyError(error.code);
      return;
    }
    this.transition({ phase: "unrecoverableError" });
    this.bridge.notifyError("CUSTOMER_SESSION_ERROR");
  }

  private transition(state: CustomerSessionState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
