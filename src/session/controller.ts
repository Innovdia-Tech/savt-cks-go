import { ApiClientError, type CustomerApi } from "../api/client";
import type { BootstrapData, SessionData } from "../api/contracts";
import { BridgeError, type NativeBridgePort } from "../webview/bridge";
import { normalizeMalaysianMobile } from "./mobile";

export type OtpFeedback =
  "invalidMobile" | "invalidCode" | "invalid" | "rateLimited" | "unavailable";

export type CustomerSessionState =
  | { phase: "loading" }
  | { phase: "authenticated"; expiresAt: string }
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
    if (this.state.phase !== "authenticated" || !this.csrfToken)
      throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
    try {
      const result = await operation(this.csrfToken);
      if (generation !== this.generation)
        throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
      return result;
    } catch (error) {
      if (
        generation === this.generation &&
        error instanceof ApiClientError &&
        error.category === "expired"
      ) {
        ++this.generation;
        this.fail(error);
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
