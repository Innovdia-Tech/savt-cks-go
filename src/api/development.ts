import { ApiClientError, type CustomerApi } from "./client";
import type {
  BootstrapData,
  SessionData,
  WebOtpAuthorizeBody,
  WebOtpAuthorizeData,
  WebOtpRequestBody,
  WebOtpRequestData,
} from "./contracts";
import type { HandoffDetail } from "../webview/bridge";

const randomOpaque = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join(
    "",
  );
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

export class DevelopmentCustomerApi implements CustomerApi {
  private pending: BootstrapData | undefined;
  private pendingOtp: { otpRequestId: string } | undefined;
  private session: SessionData | undefined;

  constructor(
    production: boolean,
    private readonly randomUuid: () => string = () => crypto.randomUUID(),
    private readonly randomToken: () => string = randomOpaque,
  ) {
    if (production)
      throw new Error(
        "Development customer session is unavailable in production.",
      );
  }

  async bootstrap(): Promise<BootstrapData> {
    this.session = undefined;
    this.pendingOtp = undefined;
    this.pending = {
      protocolVersion: "1",
      launchRequestId: this.randomUuid(),
      state: this.randomToken(),
      codeChallenge: this.randomToken(),
      codeChallengeMethod: "S256",
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
    return this.pending;
  }

  async requestWebOtp(body: WebOtpRequestBody): Promise<WebOtpRequestData> {
    if (!this.pending || body.launchRequestId !== this.pending.launchRequestId)
      throw new ApiClientError("expired", "CUSTOMER_LAUNCH_INVALID");
    if (!/^\+601\d{8,9}$/.test(body.mobileNumber))
      throw new ApiClientError("unrecoverable", "CUSTOMER_OTP_INVALID");
    const otpRequestId = this.randomToken();
    this.pendingOtp = { otpRequestId };
    return { otpRequestId, resendAfterSeconds: 60 };
  }

  async authorizeWebOtp(
    body: WebOtpAuthorizeBody,
  ): Promise<WebOtpAuthorizeData> {
    const pending = this.pending;
    if (
      !pending ||
      body.launchRequestId !== pending.launchRequestId ||
      body.state !== pending.state ||
      body.codeChallenge !== pending.codeChallenge ||
      body.protocolVersion !== pending.protocolVersion ||
      body.codeChallengeMethod !== pending.codeChallengeMethod
    )
      throw new ApiClientError("expired", "CUSTOMER_LAUNCH_INVALID");
    if (
      !this.pendingOtp ||
      body.otpRequestId !== this.pendingOtp.otpRequestId ||
      body.otp !== "123456"
    )
      throw new ApiClientError("unrecoverable", "CUSTOMER_OTP_INVALID");
    this.pendingOtp = undefined;
    return {
      protocolVersion: "1",
      code: "D".repeat(43),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  async exchange(handoff: HandoffDetail): Promise<SessionData> {
    const pending = this.pending;
    this.pending = undefined;
    this.pendingOtp = undefined;
    if (
      !pending ||
      handoff.protocolVersion !== "1" ||
      handoff.launchRequestId !== pending.launchRequestId ||
      handoff.state !== pending.state ||
      handoff.code !== "D".repeat(43)
    ) {
      throw new ApiClientError("expired", "CUSTOMER_LAUNCH_INVALID");
    }
    this.session = {
      authenticated: true,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      csrfToken: this.randomToken(),
    };
    return this.session;
  }

  async status(): Promise<SessionData> {
    if (!this.session)
      throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
    return this.session;
  }

  async logout(csrfToken: string): Promise<void> {
    if (this.session && csrfToken !== this.session.csrfToken) {
      throw new ApiClientError("unrecoverable", "CUSTOMER_CSRF_INVALID");
    }
    this.pending = undefined;
    this.pendingOtp = undefined;
    this.session = undefined;
  }
}
