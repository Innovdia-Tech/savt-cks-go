import { parseProfile, type Profile } from "./contracts";
import {
  parseAddress,
  parseAddresses,
  type Address,
} from "../addresses/contracts";
import type { AddressOperation } from "../addresses/operation";
import { CustomerDataError, failureFor } from "./errors";
import { parseApiErrorEnvelope } from "../api/contracts";
import { ApiClientError } from "../api/client";
import type { CustomerSessionController } from "../session/controller";
export interface CustomerDataPort {
  profile(): Promise<Profile>;
  addresses(): Promise<Address[]>;
  mutate(operation: AddressOperation): Promise<Address>;
}
export class CustomerDataApi implements CustomerDataPort {
  constructor(
    private readonly origin: string,
    private readonly session: CustomerSessionController,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {}
  profile() {
    return this.request("/api/v1/customer/me", parseProfile);
  }
  addresses() {
    return this.request("/api/v1/customer/me/addresses", parseAddresses);
  }
  mutate(op: AddressOperation) {
    return this.request(op.path, parseAddress, op);
  }
  private async request<T>(
    path: string,
    parse: (value: unknown) => T,
    op?: AddressOperation,
  ): Promise<T> {
    try {
      return await this.session.withCredentials(async (token) => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new CustomerDataError("retryable", "REQUEST_TIMEOUT"));
            controller.abort();
          }, this.timeoutMs);
        });
        const execute = async () => {
          const headers: Record<string, string> = {
            Accept: "application/json",
          };
          if (op) {
            headers["Content-Type"] = "application/json";
            headers["x-cks-csrf"] = token;
            if (op.key) headers["Idempotency-Key"] = op.key;
            if (op.version) headers["If-Match"] = `"${op.version}"`;
          }
          let response: Response;
          try {
            response = await this.fetcher(this.origin + path, {
              method: op?.method ?? "GET",
              headers,
              credentials: "include",
              cache: "no-store",
              signal: controller.signal,
              ...(op ? { body: op.body } : {}),
            });
          } catch {
            throw new CustomerDataError("offline", "NETWORK_ERROR");
          }
          if (response.status === 401)
            throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
          if (!response.ok) {
            let code = "INVALID_RESPONSE";
            try {
              code = parseApiErrorEnvelope(await response.json())?.code ?? code;
            } catch {
              /* Never expose an untrusted error body. */
            }
            const category = failureFor(response.status, code);
            if (category === "expired")
              throw new ApiClientError("expired", code);
            throw new CustomerDataError(category, code);
          }
          try {
            return parse(await response.json());
          } catch {
            throw new CustomerDataError(
              op ? "retryable" : "invalid",
              "INVALID_RESPONSE",
            );
          }
        };
        try {
          return await Promise.race([deadline, execute()]);
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (e) {
      if (e instanceof ApiClientError && e.category === "expired")
        throw new CustomerDataError("expired", e.code);
      throw e;
    }
  }
}
