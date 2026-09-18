import {
  parseApiErrorEnvelope,
  parseBootstrapEnvelope,
  parseSessionEnvelope,
  type BootstrapData,
  type SessionData,
} from "./contracts";
import type { HandoffDetail } from "../webview/bridge";

export type ApiFailureCategory =
  "offline" | "expired" | "retryable" | "unrecoverable";

export class ApiClientError extends Error {
  constructor(
    readonly category: ApiFailureCategory,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(code);
    this.name = "ApiClientError";
  }
}

export interface CustomerApi {
  bootstrap(): Promise<BootstrapData>;
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
    private readonly fetcher: typeof fetch = fetch,
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
    const response = await this.request("/api/v1/customer/session/logout", {
      method: "POST",
      headers: { "x-cks-csrf": csrfToken },
      body: "{}",
    });
    if (response.status !== 204) await this.throwResponseError(response);
  }

  private async jsonRequest<T>(
    path: string,
    parser: (value: unknown) => T,
    init: RequestInit,
  ): Promise<T> {
    const response = await this.request(path, init);
    if (!response.ok) await this.throwResponseError(response);
    try {
      return parser(await response.json());
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError("unrecoverable", "INVALID_RESPONSE");
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
    throw new ApiClientError(category, code, error?.requestId);
  }
}
