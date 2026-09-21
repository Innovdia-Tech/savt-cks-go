import { ApiClientError } from "../api/client";
import { parseApiErrorEnvelope } from "../api/contracts";
import { record, exact, uuid } from "../customer/contracts";
import type { CustomerSessionController } from "../session/controller";
import {
  parseAssignment,
  parseCategories,
  parseProducts,
  parseDetail,
  type Assignment,
} from "./contracts";
export class CatalogueError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export type AddressBinding = { id: string; rowVersion: number };
export type Filter = { page: number; q?: string; categoryId?: string };
export const safeCodes = [
  "VALIDATION_FAILED",
  "CUSTOMER_SESSION_INVALID",
  "SAVT_IDENTITY_INVALID",
  "CUSTOMER_NOT_FOUND",
  "SAVT_IDENTITY_ADAPTER_UNAVAILABLE",
  "CUSTOMER_ORGANISATION_UNAVAILABLE",
  "INTERNAL_ERROR",
  "CUSTOMER_ASSIGNMENT_CONTEXT_REQUIRED",
  "CUSTOMER_ASSIGNMENT_CONTEXT_INVALID",
  "CUSTOMER_CSRF_INVALID",
  "CUSTOMER_ADDRESS_NOT_FOUND",
  "CUSTOMER_ADDRESS_INACTIVE",
  "CHECKOUT_LOCATION_UNAVAILABLE",
  "CUSTOMER_ADDRESS_CHANGED",
  "CUSTOMER_ASSIGNMENT_CHANGED",
  "CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED",
  "CUSTOMER_OUTLET_ASSIGNMENT_MISMATCH",
  "CUSTOMER_ASSIGNED_OUTLET_UNAVAILABLE",
  "CUSTOMER_NO_SERVICEABLE_OUTLET",
  "CUSTOMER_ASSIGNMENT_INCOMPLETE",
  "CUSTOMER_ASSIGNMENT_CONTEXT_UNAVAILABLE",
  "CUSTOMER_PRODUCT_NOT_FOUND",
];
export class CatalogueApi {
  constructor(
    private readonly origin: string,
    private readonly session: CustomerSessionController,
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private readonly timeoutMs = 15000,
  ) {}
  assign(address: AddressBinding, signal?: AbortSignal) {
    if (
      !uuid(address.id) ||
      !Number.isSafeInteger(address.rowVersion) ||
      address.rowVersion < 1
    )
      return Promise.reject(new CatalogueError("VALIDATION_FAILED"));
    return this.request(
      "/api/v1/customer/outlet-assignment",
      parseAssignment,
      undefined,
      JSON.stringify({
        customerAddressId: address.id,
        addressRowVersion: address.rowVersion,
      }),
      signal,
    ).then((e) => e.data);
  }
  categories(
    a: Assignment,
    filter: Filter = { page: 1 },
    signal?: AbortSignal,
  ) {
    return this.request(
      this.path(a) + "/categories?" + this.query(filter, true),
      parseCategories,
      a,
      undefined,
      signal,
    );
  }
  products(a: Assignment, filter: Filter, signal?: AbortSignal) {
    return this.request(
      this.path(a) + "/products?" + this.query(filter),
      parseProducts,
      a,
      undefined,
      signal,
    );
  }
  detail(a: Assignment, id: string, signal?: AbortSignal) {
    if (!uuid(id))
      return Promise.reject(new CatalogueError("VALIDATION_FAILED"));
    return this.request(
      this.path(a) + "/products/" + id,
      parseDetail,
      a,
      undefined,
      signal,
    );
  }
  private path(a: Assignment) {
    if (!uuid(a.outlet.id)) throw new CatalogueError("VALIDATION_FAILED");
    return "/api/v1/customer/outlets/" + a.outlet.id;
  }
  private query(f: Filter, categories = false) {
    if (
      !Number.isInteger(f.page) ||
      f.page < 1 ||
      f.page > 1000 ||
      (f.q !== undefined && f.q.length > 200) ||
      (f.categoryId !== undefined && !uuid(f.categoryId))
    )
      throw new CatalogueError("VALIDATION_FAILED");
    const q = new URLSearchParams({
      page: String(f.page),
      pageSize: categories ? "50" : "24",
    });
    if (!categories) {
      if (f.q?.trim()) q.set("q", f.q.trim());
      if (f.categoryId) q.set("categoryId", f.categoryId);
    }
    return q.toString();
  }
  private async request<T>(
    path: string,
    parse: (v: unknown) => T,
    assignment?: Assignment,
    body?: string,
    external?: AbortSignal,
  ): Promise<T> {
    try {
      return await this.session.withCredentials(async (token) => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const abort = () => controller.abort();
        external?.addEventListener("abort", abort, { once: true });
        if (external?.aborted) controller.abort();
        const execute = async () => {
          const headers: Record<string, string> = {
            Accept: "application/json",
          };
          if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            headers["x-cks-csrf"] = token;
          }
          if (assignment)
            headers["X-CKS-Assignment-Context"] =
              assignment.assignmentContextId;
          let response: Response;
          try {
            response = await this.fetcher(this.origin + path, {
              method: body === undefined ? "GET" : "POST",
              headers,
              credentials: "include",
              cache: "no-store",
              signal: controller.signal,
              ...(body === undefined ? {} : { body }),
            });
          } catch {
            throw new CatalogueError(
              external?.aborted ? "CANCELLED" : "NETWORK_ERROR",
            );
          }
          if (response.status === 401)
            throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
          if (!response.ok) {
            let code = "INVALID_RESPONSE";
            try {
              const v: unknown = await response.json();
              const parsed =
                record(v) && exact(v, ["error", "meta"])
                  ? parseApiErrorEnvelope(v)
                  : null;
              if (parsed && safeCodes.includes(parsed.code)) code = parsed.code;
            } catch {
              /* Discard untrusted bodies. */
            }
            if (
              code === "SAVT_IDENTITY_INVALID" ||
              code === "CUSTOMER_SESSION_INVALID"
            )
              throw new ApiClientError("expired", code);
            throw new CatalogueError(code);
          }
          try {
            return parse(await response.json());
          } catch {
            throw new CatalogueError("INVALID_RESPONSE");
          }
        };
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new CatalogueError("REQUEST_TIMEOUT"));
            controller.abort();
          }, this.timeoutMs);
        });
        try {
          return await Promise.race([execute(), deadline]);
        } finally {
          clearTimeout(timer);
          external?.removeEventListener("abort", abort);
        }
      });
    } catch (error) {
      if (error instanceof ApiClientError)
        throw new CatalogueError(
          error.category === "expired"
            ? "CUSTOMER_SESSION_INVALID"
            : "INVALID_RESPONSE",
        );
      throw error;
    }
  }
}
export type CataloguePort = Pick<
  CatalogueApi,
  "assign" | "categories" | "products" | "detail"
>;
