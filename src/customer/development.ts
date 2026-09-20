import { syntheticAddress, syntheticProfile } from "./fixtures";
import { validateAddressInput, type Address } from "../addresses/contracts";
import type { Profile } from "./contracts";
const response = (data: unknown) => Response.json({ data });
const failure = (status: number, code: string) =>
  Response.json(
    { error: { code, message: "Synthetic development error." } },
    { status },
  );
export class DevelopmentDataAdapter {
  private profileValue: Profile = { ...syntheticProfile };
  private rows: Address[] = [];
  private failure: string | undefined;
  private serial = 4;
  private receipts = new Map<string, { hash: string; id: string }>();
  constructor(production: boolean, scenario = "mixed") {
    if (production)
      throw new Error(
        "Development customer data is unavailable in production.",
      );
    this.reset(scenario);
  }
  reset(scenario: string) {
    this.failure = undefined;
    this.receipts.clear();
    this.serial = 4;
    this.profileValue = {
      ...syntheticProfile,
      ...(scenario === "readonly"
        ? { accountStatus: "DEACTIVATED" as const }
        : {}),
      ...(scenario === "stale" ? { savtSyncStatus: "STALE" as const } : {}),
      ...(scenario === "failed" ? { savtSyncStatus: "FAILED" as const } : {}),
    };
    this.rows =
      scenario === "empty"
        ? []
        : [
            { ...syntheticAddress },
            ...(scenario === "default"
              ? []
              : [
                  {
                    ...syntheticAddress,
                    id: "33333333-3333-4333-8333-333333333333",
                    label: "Demo office",
                    isDefault: false,
                    status: "INACTIVE" as const,
                  },
                  {
                    ...syntheticAddress,
                    id: "44444444-4444-4444-8444-444444444444",
                    label: "Demo flat",
                    addressLine1: "2 Example Street",
                    isDefault: false,
                  },
                  {
                    ...syntheticAddress,
                    id: "55555555-5555-4555-8555-555555555555",
                    label: "Demo suburb",
                    addressLine1: "3 Example Street",
                    city: "Sample Town",
                    isDefault: false,
                  },
                ]),
          ];
  }
  failNext(kind: string) {
    this.failure = kind;
  }
  fetch: typeof fetch = async (input, init) => {
    const path = String(input).replace(/^https?:\/\/[^/]+/, "");
    const mode = this.failure;
    this.failure = undefined;
    if (mode === "offline") throw new TypeError("Synthetic offline");
    if (mode === "retryable") return failure(503, "PROVIDER_UNAVAILABLE");
    if (mode === "expired") return failure(401, "CUSTOMER_SESSION_INVALID");
    if (mode === "csrf") return failure(403, "CUSTOMER_CSRF_INVALID");
    if (mode === "conflict") {
      if (this.rows[0])
        this.rows[0] = {
          ...this.rows[0],
          rowVersion: this.rows[0].rowVersion + 1,
        };
      return failure(412, "CUSTOMER_ADDRESS_VERSION_CONFLICT");
    }
    if (init?.credentials !== "include")
      return failure(401, "CUSTOMER_SESSION_INVALID");
    if (path === "/api/v1/customer/me" && init.method === "GET")
      return response(this.profileValue);
    if (path === "/api/v1/customer/me/addresses" && init.method === "GET")
      return response(this.rows);
    const h = new Headers(init?.headers);
    if (!h.get("x-cks-csrf")) return failure(403, "CUSTOMER_CSRF_INVALID");
    if (this.profileValue.accountStatus !== "ACTIVE")
      return failure(403, "CUSTOMER_ADDRESS_READ_ONLY");
    const match =
      /^\/api\/v1\/customer\/me\/addresses(?:\/([a-f0-9-]+)(?:\/(default|deactivate|reactivate))?)?$/.exec(
        path,
      );
    if (!match) return failure(404, "CUSTOMER_ADDRESS_NOT_FOUND");
    const kind = !match[1] ? "create" : (match[2] ?? "edit");
    const row = this.rows.find((a) => a.id === match[1]);
    const key = h.get("Idempotency-Key");
    const hash = path + "|" + h.get("If-Match") + "|" + String(init?.body);
    if (kind !== "edit" && !key)
      return failure(400, "IDEMPOTENCY_KEY_REQUIRED");
    if (key && this.receipts.has(key)) {
      const saved = this.receipts.get(key)!;
      if (saved.hash !== hash) return failure(409, "IDEMPOTENCY_KEY_REUSED");
      return response(this.rows.find((a) => a.id === saved.id));
    }
    if (kind !== "create") {
      if (!row) return failure(404, "CUSTOMER_ADDRESS_NOT_FOUND");
      if (!h.get("If-Match")) return failure(428, "PRECONDITION_REQUIRED");
      if (h.get("If-Match") !== `"${row.rowVersion}"`)
        return failure(412, "CUSTOMER_ADDRESS_VERSION_CONFLICT");
      if (
        (kind === "default" || kind === "deactivate") &&
        row.status !== "ACTIVE"
      )
        return failure(409, "CUSTOMER_ADDRESS_INACTIVE");
      if (kind === "reactivate" && row.status !== "INACTIVE")
        return failure(409, "CUSTOMER_ADDRESS_ALREADY_ACTIVE");
    }
    if (
      (kind === "create" || kind === "reactivate") &&
      this.rows.filter((a) => a.status === "ACTIVE").length >= 20
    )
      return failure(409, "CUSTOMER_ADDRESS_LIMIT");
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (
      (kind === "create" || kind === "edit") &&
      Object.keys(validateAddressInput({ ...row, ...body })).length
    )
      return failure(400, "CUSTOMER_ADDRESS_INVALID");
    if (kind === "default" || (kind === "create" && body.isDefault))
      this.rows = this.rows.map((a) =>
        a.isDefault
          ? { ...a, isDefault: false, rowVersion: a.rowVersion + 1 }
          : a,
      );
    const suffix = String(this.serial++).padStart(12, "0");
    const result: Address =
      kind === "create"
        ? {
            ...syntheticAddress,
            ...body,
            id: `44444444-4444-4444-8444-${suffix}`,
            isDefault: body.isDefault ?? false,
          }
        : {
            ...row!,
            ...(kind === "edit"
              ? body
              : kind === "default"
                ? { isDefault: true }
                : {
                    status: kind === "deactivate" ? "INACTIVE" : "ACTIVE",
                    isDefault: false,
                  }),
            rowVersion: row!.rowVersion + 1,
          };
    this.rows =
      kind === "create"
        ? [...this.rows, result]
        : this.rows.map((a) => (a.id === result.id ? result : a));
    if (key) this.receipts.set(key, { hash, id: result.id });
    if (mode === "lostResponse") throw new TypeError("Synthetic response loss");
    return response(result);
  };
}
