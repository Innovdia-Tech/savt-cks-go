import { ApiClientError, type CustomerApi } from "../api/client";
import type { BootstrapData, SessionData } from "../api/contracts";
import { BridgeError, type NativeBridgePort } from "../webview/bridge";
import { normalizeMalaysianMobile } from "./mobile";

export type OtpFeedback =
  "invalidMobile" | "invalidCode" | "invalid" | "rateLimited" | "unavailable";

export type CustomerSessionState =
  | { phase: "loading" }
  | {
      phase: "authenticated";
      expiresAt: string;
      recovery?: "checking" | "authorizing" | "offline" | "failed" | "signIn";
      manualRecovery?: true;
      canRetryRecovery?: true;
    }
  | { phase: "awaitingMobile"; error?: OtpFeedback; retryAfterSeconds?: number }
  | { phase: "requestingOtp"; resending: boolean }
  | {
      phase: "awaitingOtp";
      resendAfterSeconds: number;
      error?: OtpFeedback;
      retryAfterSeconds?: number;
    }
  | { phase: "verifyingOtp" }
  | { phase: "pilotDenied" }
  | { phase: "browserUnavailable"; reason: "disabled" | "unverified" }
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
  private bootstrapData: BootstrapData | undefined;
  private mobileNumber: string | undefined;
  private otpRequestId: string | undefined;
  private resendAt = 0;
  private retryAt = 0;
  private resumeInFlight: Promise<boolean> | undefined;
  private recoveryAttempted = false;
  private nativeResumeSeen = false;

  constructor(
    private readonly api: CustomerApi,
    private readonly bridge: NativeBridgePort,
    private readonly options: {
      entryMode?: "embedded" | "standalone";
      now?: () => number;
    } = {},
  ) {}

  getSnapshot = (): CustomerSessionState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async start(): Promise<void> {
    // A mounted, authorized native document must use its explicit recovery gate.
    if (this.state.phase === "authenticated") {
      await this.resume();
      return;
    }
    const generation = ++this.generation;
    this.clearCredentials();
    this.clearOtpContext();
    this.transition({ phase: "loading" });
    try {
      const session = await this.api.status();
      if (generation !== this.generation) return;
      this.authenticate(session);
      return;
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        this.options.entryMode === "standalone" &&
        this.isPilotDenied(error)
      ) {
        this.transition({ phase: "pilotDenied" });
        return;
      }
      if (!(error instanceof ApiClientError) || error.category !== "expired") {
        this.fail(error);
        return;
      }
    }

    if (this.options.entryMode === "standalone") {
      try {
        const capability = await this.api.capabilities?.();
        if (generation !== this.generation) return;
        if (!capability?.browserOtpEnabled) {
          this.transition({
            phase: "browserUnavailable",
            reason: capability ? "disabled" : "unverified",
          });
          return;
        }
      } catch (error) {
        if (generation !== this.generation) return;
        if (
          error instanceof ApiClientError &&
          ["offline", "retryable"].includes(error.category)
        )
          this.fail(error);
        else
          this.transition({
            phase: "browserUnavailable",
            reason: "unverified",
          });
        return;
      }
    }

    try {
      const bootstrap = await this.api.bootstrap();
      if (generation !== this.generation) return;
      if (this.options.entryMode === "standalone") {
        this.bootstrapData = bootstrap;
        this.transition({ phase: "awaitingMobile" });
        return;
      }
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
      if (generation !== this.generation) return;
      if (this.options.entryMode === "standalone" && this.isPilotDenied(error))
        this.transition({ phase: "pilotDenied" });
      else this.fail(error);
    }
  }

  retry(): Promise<void> {
    return this.start();
  }

  /** Validate once on foreground return; never replay the failed operation. */
  resume(
    options: { retry?: boolean; native?: boolean } = {},
  ): Promise<boolean> {
    if (options.native) this.nativeResumeSeen = true;
    if (this.resumeInFlight) return this.resumeInFlight;
    if (this.state.phase !== "authenticated") return Promise.resolve(false);
    if (
      this.options.entryMode !== "embedded" ||
      !this.bridge.requestSessionRecovery
    )
      return Promise.resolve(true);
    const manualNeeded = this.state.manualRecovery === true;
    const previousRecovery = this.state.recovery;
    const canRetryRecovery = this.state.canRetryRecovery === true;
    const explicitRetry = options.retry === true && manualNeeded;
    let generation = this.generation;
    const expiresAt = this.state.expiresAt;
    this.clearCredentials();
    this.transition({
      phase: "authenticated",
      expiresAt,
      recovery: "checking",
    });
    const current = () =>
      generation === this.generation && this.state.phase === "authenticated";
    const recover = async (): Promise<boolean> => {
      try {
        const session = await this.api.status();
        if (!current()) return false;
        this.recoveryAttempted = false;
        this.csrfToken = session.csrfToken;
        this.transition({
          phase: "authenticated",
          expiresAt: session.expiresAt,
        });
        this.bridge.notifySessionValidated?.(this.nativeResumeSeen);
        return true;
      } catch (error) {
        if (!current()) return false;
        if (
          !(error instanceof ApiClientError) ||
          error.code !== "CUSTOMER_SESSION_INVALID"
        ) {
          this.resumeFailure(error, expiresAt);
          return false;
        }
      }
      generation = ++this.generation;
      if (this.recoveryAttempted && !explicitRetry) {
        this.transition({
          phase: "authenticated",
          expiresAt,
          recovery:
            manualNeeded && previousRecovery === "offline"
              ? "offline"
              : "failed",
          ...(manualNeeded ? { manualRecovery: true as const } : {}),
          ...(canRetryRecovery ? { canRetryRecovery: true as const } : {}),
        });
        return false;
      }
      this.recoveryAttempted = true;
      this.transition({
        phase: "authenticated",
        expiresAt,
        recovery: "authorizing",
      });
      try {
        // The host owns document/handoff generations. Obtain its explicit grant
        // before bootstrap: a second ordinary launch in this document is forbidden.
        await this.bridge.requestSessionRecovery!(
          explicitRetry ? { retry: true } : undefined,
        );
        if (!current()) return false;
        this.bridge.verifySessionRecovery?.();
        const bootstrap = await this.api.bootstrap();
        if (!current()) return false;
        this.bridge.verifySessionRecovery?.();
        const handoff = await this.bridge.requestLaunchCode({
          protocolVersion: bootstrap.protocolVersion,
          launchRequestId: bootstrap.launchRequestId,
          state: bootstrap.state,
          codeChallenge: bootstrap.codeChallenge,
          codeChallengeMethod: bootstrap.codeChallengeMethod,
        });
        if (!current()) return false;
        this.bridge.verifySessionRecovery?.();
        const session = await this.api.exchange(handoff);
        if (!current()) return false;
        this.bridge.verifySessionRecovery?.();
        this.authenticate(session);
        // Exchange does not reset the attempt budget. Only a later positive
        // status observation closes this failure episode.
        return true;
      } catch (error) {
        if (current()) this.resumeFailure(error, expiresAt);
        return false;
      }
    };
    const pending = recover().finally(() => {
      if (this.resumeInFlight === pending) this.resumeInFlight = undefined;
    });
    this.resumeInFlight = pending;
    return pending;
  }

  private resumeFailure(error: unknown, expiresAt: string): void {
    this.clearCredentials();
    const retryable =
      (error instanceof ApiClientError &&
        ["offline", "retryable"].includes(error.category)) ||
      (error instanceof BridgeError &&
        ["network", "timeout"].includes(error.kind));
    const recovery =
      (error instanceof ApiClientError && error.category === "offline") ||
      (error instanceof BridgeError && error.kind === "network")
        ? "offline"
        : (error instanceof ApiClientError && error.category === "expired") ||
            (error instanceof BridgeError && error.kind === "sign-in-required")
          ? "signIn"
          : "failed";
    this.transition({
      phase: "authenticated",
      expiresAt,
      recovery,
      ...(retryable ? { canRetryRecovery: true as const } : {}),
      ...(retryable && this.recoveryAttempted
        ? { manualRecovery: true as const }
        : {}),
    });
    this.bridge.notifySessionRecoveryFailed?.(
      retryable ? "network" : "invalid-session",
    );
    // Keep drafts mounted and gated; reporting a generic bridge launch error
    // would retire this document and discard the Basket/pending payment.
  }

  async requestOtp(rawMobile: string): Promise<void> {
    if (
      this.options.entryMode !== "standalone" ||
      this.state.phase !== "awaitingMobile" ||
      !this.bootstrapData
    )
      return;
    if (this.retryRemainingSeconds() > 0) return;
    const mobileNumber = normalizeMalaysianMobile(rawMobile);
    if (!mobileNumber) {
      this.transition({ phase: "awaitingMobile", error: "invalidMobile" });
      return;
    }
    const generation = this.generation;
    const bootstrap = this.bootstrapData;
    this.transition({ phase: "requestingOtp", resending: false });
    try {
      const result = await this.api.requestWebOtp({
        launchRequestId: bootstrap.launchRequestId,
        mobileNumber,
      });
      if (generation !== this.generation) return;
      this.mobileNumber = mobileNumber;
      this.otpRequestId = result.otpRequestId;
      this.retryAt = 0;
      this.resendAt = this.now() + result.resendAfterSeconds * 1000;
      this.transition({
        phase: "awaitingOtp",
        resendAfterSeconds: result.resendAfterSeconds,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      if (this.isLaunchInvalid(error)) return this.start();
      if (this.isPilotDenied(error)) {
        this.clearOtpContext();
        this.transition({ phase: "pilotDenied" });
        return;
      }
      const feedback = this.otpFeedback(error);
      this.applyRetryAfter(error);
      if (feedback)
        this.transition({
          phase: "awaitingMobile",
          error: feedback,
          ...this.retryAfter(error),
        });
      else this.fail(error);
    }
  }

  resendRemainingSeconds(): number {
    return Math.max(
      0,
      Math.ceil((this.resendAt - this.now()) / 1000),
      this.retryRemainingSeconds(),
    );
  }

  retryRemainingSeconds(): number {
    return Math.max(0, Math.ceil((this.retryAt - this.now()) / 1000));
  }

  async resendOtp(): Promise<void> {
    if (
      this.state.phase !== "awaitingOtp" ||
      !this.bootstrapData ||
      !this.mobileNumber ||
      this.resendRemainingSeconds() > 0
    )
      return;
    const generation = this.generation;
    const { launchRequestId } = this.bootstrapData;
    const mobileNumber = this.mobileNumber;
    const resendAfterSeconds = this.state.resendAfterSeconds;
    this.transition({ phase: "requestingOtp", resending: true });
    try {
      const result = await this.api.requestWebOtp({
        launchRequestId,
        mobileNumber,
      });
      if (generation !== this.generation) return;
      this.otpRequestId = result.otpRequestId;
      this.retryAt = 0;
      this.resendAt = this.now() + result.resendAfterSeconds * 1000;
      this.transition({
        phase: "awaitingOtp",
        resendAfterSeconds: result.resendAfterSeconds,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      if (this.isLaunchInvalid(error)) return this.start();
      if (this.isPilotDenied(error)) {
        this.clearOtpContext();
        this.transition({ phase: "pilotDenied" });
        return;
      }
      const feedback = this.otpFeedback(error);
      this.applyRetryAfter(error);
      if (feedback)
        this.transition({
          phase: "awaitingOtp",
          resendAfterSeconds,
          error: feedback,
          ...this.retryAfter(error),
        });
      else this.fail(error);
    }
  }

  async verifyOtp(otp: string): Promise<void> {
    if (
      this.options.entryMode !== "standalone" ||
      this.state.phase !== "awaitingOtp" ||
      !this.bootstrapData ||
      !this.otpRequestId
    )
      return;
    if (this.retryRemainingSeconds() > 0) return;
    const resendAfterSeconds = this.state.resendAfterSeconds;
    if (!/^\d{6}$/.test(otp)) {
      this.transition({
        phase: "awaitingOtp",
        resendAfterSeconds,
        error: "invalidCode",
      });
      return;
    }
    const generation = this.generation;
    const bootstrap = this.bootstrapData;
    const otpRequestId = this.otpRequestId;
    this.transition({ phase: "verifyingOtp" });
    try {
      const authorization = await this.api.authorizeWebOtp({
        protocolVersion: bootstrap.protocolVersion,
        otpRequestId,
        launchRequestId: bootstrap.launchRequestId,
        state: bootstrap.state,
        codeChallenge: bootstrap.codeChallenge,
        codeChallengeMethod: bootstrap.codeChallengeMethod,
        otp,
      });
      if (generation !== this.generation) return;
      const session = await this.api.exchange({
        protocolVersion: authorization.protocolVersion,
        launchRequestId: bootstrap.launchRequestId,
        state: bootstrap.state,
        code: authorization.code,
      });
      if (generation !== this.generation) return;
      this.clearOtpContext();
      this.authenticate(session);
    } catch (error) {
      if (generation !== this.generation) return;
      if (this.isLaunchInvalid(error)) return this.start();
      if (this.isPilotDenied(error)) {
        this.clearOtpContext();
        this.transition({ phase: "pilotDenied" });
        return;
      }
      const feedback = this.otpFeedback(error);
      this.applyRetryAfter(error);
      if (feedback)
        this.transition({
          phase: "awaitingOtp",
          resendAfterSeconds,
          error: feedback,
          ...this.retryAfter(error),
        });
      else this.fail(error);
    }
  }

  async logout(): Promise<void> {
    const generation = ++this.generation;
    const csrfToken = this.csrfToken;
    this.clearCredentials();
    this.clearOtpContext();
    this.transition({ phase: "loading" });
    try {
      if (csrfToken) await this.api.logout(csrfToken);
      if (generation === this.generation) this.transition({ phase: "expired" });
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  // Infrastructure only: credentials never enter a presentation snapshot.
  async withCredentials<T>(
    operation: (csrfToken: string) => Promise<T>,
  ): Promise<T> {
    const generation = this.generation;
    if (
      this.state.phase !== "authenticated" ||
      this.state.recovery ||
      !this.csrfToken
    )
      throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
    try {
      const result = await operation(this.csrfToken);
      if (this.resumeInFlight && !(await this.resumeInFlight))
        throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
      if (generation !== this.generation)
        throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
      return result;
    } catch (error) {
      if (
        generation === this.generation &&
        error instanceof ApiClientError &&
        error.category === "expired"
      ) {
        if (
          this.options.entryMode === "embedded" &&
          this.bridge.requestSessionRecovery
        ) {
          void this.resume();
        } else {
          ++this.generation;
          this.fail(error);
        }
      }
      throw error;
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

  private clearOtpContext(): void {
    this.bootstrapData = undefined;
    this.mobileNumber = undefined;
    this.otpRequestId = undefined;
    this.resendAt = 0;
    this.retryAt = 0;
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private isLaunchInvalid(error: unknown): boolean {
    return (
      error instanceof ApiClientError &&
      error.code === "CUSTOMER_LAUNCH_INVALID"
    );
  }

  private isPilotDenied(error: unknown): boolean {
    return (
      error instanceof ApiClientError &&
      error.code === "CUSTOMER_PILOT_ACCESS_DENIED"
    );
  }

  private otpFeedback(error: unknown): OtpFeedback | undefined {
    if (!(error instanceof ApiClientError)) return undefined;
    if (error.code === "CUSTOMER_OTP_INVALID") return "invalid";
    if (error.code === "CUSTOMER_OTP_RATE_LIMITED") return "rateLimited";
    if (error.code === "CUSTOMER_OTP_UNAVAILABLE") return "unavailable";
    return undefined;
  }

  private retryAfter(error: unknown): { retryAfterSeconds?: number } {
    return error instanceof ApiClientError && error.retryAfterSeconds
      ? { retryAfterSeconds: error.retryAfterSeconds }
      : {};
  }

  private applyRetryAfter(error: unknown): void {
    if (error instanceof ApiClientError && error.retryAfterSeconds)
      this.retryAt = this.now() + error.retryAfterSeconds * 1000;
  }

  private fail(error: unknown): void {
    this.clearCredentials();
    this.clearOtpContext();
    if (
      this.options.entryMode === "standalone" &&
      error instanceof ApiClientError &&
      error.code === "CUSTOMER_BROWSER_AUTH_UNAVAILABLE"
    ) {
      this.transition({ phase: "browserUnavailable", reason: "disabled" });
      return;
    }
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
