import { ApiClientError, type CustomerApi } from "./client";
import type { BootstrapData, SessionData } from "./contracts";
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

  async exchange(handoff: HandoffDetail): Promise<SessionData> {
    const pending = this.pending;
    this.pending = undefined;
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
    this.session = undefined;
  }
}
