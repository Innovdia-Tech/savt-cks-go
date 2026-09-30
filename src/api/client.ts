import {
  parseApiErrorEnvelope,
  parseBootstrapEnvelope,
  parseSessionEnvelope,
  parseWebOtpAuthorizeEnvelope,
  parseWebOtpRequestEnvelope,
  type BootstrapData,
  type SessionData,
  type WebOtpAuthorizeBody,
  type WebOtpAuthorizeData,
  type WebOtpRequestBody,
  type WebOtpRequestData,
} from "./contracts";
import type { HandoffDetail } from "../webview/bridge";

export type ApiFailureCategory =
  "offline" | "expired" | "retryable" | "unrecoverable";

export class ApiClientError extends Error {
  constructor(
    readonly category: ApiFailureCategory,
    readonly code: string,
    readonly requestId?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "ApiClientError";
  }
}

export interface CustomerApi {
  bootstrap(): Promise<BootstrapData>;
  requestWebOtp(body: WebOtpRequestBody): Promise<WebOtpRequestData>;
  authorizeWebOtp(body: WebOtpAuthorizeBody): Promise<WebOtpAuthorizeData>;
  exchange(handoff: HandoffDetail): Promise<SessionData>;
  status(): Promise<SessionData>;
  logout(csrfToken: string): Promise<void>;
}

const categoryFor = (status: number, code: string): ApiFailureCategory => {
  if (
    status === 401 ||
    code === "CUSTOMER_SESSION_INVALID" ||
    code === "CUSTOMER_LAUNCH_INVALID"
  )
    return "expired";
  if (status === 408 || status === 429 || status >= 500) return "retryable";
  return "unrecoverable";
};

export class CustomerApiClient implements CustomerApi {
  constructor(
    private readonly apiOrigin: string,
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private readonly timeoutMs = 15_000,
  ) {}

  bootstrap(): Promise<BootstrapData> {
    return this.jsonRequest(
      "/api/v1/customer/session/bootstrap",
      parseBootstrapEnvelope,
      {
        method: "POST",
        body: "{}",
      },
    );
  }

  requestWebOtp(body: WebOtpRequestBody): Promise<WebOtpRequestData> {
    return this.jsonRequest(
      "/api/v1/customer/session/web-otp/request",
      parseWebOtpRequestEnvelope,
      { method: "POST", body: JSON.stringify(body) },
    );
  }

  authorizeWebOtp(body: WebOtpAuthorizeBody): Promise<WebOtpAuthorizeData> {
    return this.jsonRequest(
      "/api/v1/customer/session/web-otp/authorize",
      parseWebOtpAuthorizeEnvelope,
      { method: "POST", body: JSON.stringify(body) },
    );
  }

  exchange(handoff: HandoffDetail): Promise<SessionData> {
    return this.jsonRequest(
      "/api/v1/customer/session/exchange",
      parseSessionEnvelope,
      {
        method: "POST",
        body: JSON.stringify({
          protocolVersion: handoff.protocolVersion,
          launchRequestId: handoff.launchRequestId,
          state: handoff.state,
          code: handoff.code,
        }),
      },
    );
  }

  status(): Promise<SessionData> {
    return this.jsonRequest("/api/v1/customer/session", parseSessionEnvelope, {
      method: "GET",
    });
  }

  async logout(csrfToken: string): Promise<void> {
    return this.withDeadline(async (signal) => {
      const response = await this.request("/api/v1/customer/session/logout", {
        method: "POST",
        headers: { "x-cks-csrf": csrfToken },
        body: "{}",
        signal,
      });
      if (response.status !== 204) await this.throwResponseError(response);
    });
  }

  private async jsonRequest<T>(
    path: string,
    parser: (value: unknown) => T,
    init: RequestInit,
  ): Promise<T> {
    return this.withDeadline(async (signal) => {
      const response = await this.request(path, { ...init, signal });
      if (!response.ok) await this.throwResponseError(response);
      try {
        return parser(await response.json());
      } catch (error) {
        if (error instanceof ApiClientError) throw error;
        throw new ApiClientError("unrecoverable", "INVALID_RESPONSE");
      }
    });
  }

  private async withDeadline<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        // Settle the deadline first so abort-induced fetch/body errors cannot
        // replace REQUEST_TIMEOUT. The race also bounds non-cooperative fetches.
        reject(new ApiClientError("retryable", "REQUEST_TIMEOUT"));
        controller.abort();
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([deadline, operation(controller.signal)]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init.headers as Record<string, string> | undefined),
    };
    try {
      return await this.fetcher(`${this.apiOrigin}${path}`, {
        ...init,
        headers,
        credentials: "include",
      });
    } catch {
      throw new ApiClientError("offline", "NETWORK_ERROR");
    }
  }

  private async throwResponseError(response: Response): Promise<never> {
    let error = null;
    try {
      error = parseApiErrorEnvelope(await response.json());
    } catch {
      // A malformed public error is intentionally collapsed to a safe client error.
    }
    const code = error?.code ?? "INVALID_RESPONSE";
    const category = error
      ? categoryFor(response.status, code)
      : "unrecoverable";
    const retryHeader = response.headers.get("Retry-After");
    const retryAfterSeconds =
      retryHeader && /^\d{1,4}$/.test(retryHeader)
        ? Number(retryHeader)
        : undefined;
    throw new ApiClientError(
      category,
      code,
      error?.requestId,
      code === "CUSTOMER_OTP_RATE_LIMITED" &&
        retryAfterSeconds !== undefined &&
        retryAfterSeconds >= 1 &&
        retryAfterSeconds <= 3600
        ? retryAfterSeconds
        : undefined,
    );
  }
}
