import { ApiClientError } from "../api/client";
import type { CustomerSessionController } from "../session/controller";
import { POLICY_KINDS, type PolicyKind } from "./contracts";

export type PolicyBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };
export type PolicySection = {
  id: string;
  heading: string;
  blocks: PolicyBlock[];
};
export type PublishedPolicyDocument = {
  slug: PolicyKind;
  title: string;
  version: number;
  effectiveAt: string;
  sections: PolicySection[];
};

// This port cannot retrieve drafts, require consent or record acceptance.
export interface PublishedPolicyGateway {
  listPublished(signal: AbortSignal): Promise<PublishedPolicyDocument[]>;
}

const invalid = (): never => {
  throw new ApiClientError("unrecoverable", "INVALID_RESPONSE");
};
function object(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(record, key))
  )
    return invalid();
  return record;
}
function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  )
    return invalid();
  return value;
}
function array(value: unknown, max: number, min = 1): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    return invalid();
  return value;
}

export function parsePublishedPolicyEnvelope(
  value: unknown,
): PublishedPolicyDocument[] {
  const envelope = object(value, ["data"]);
  const seen = new Set<PolicyKind>();
  return array(envelope.data, 4, 0).map((raw) => {
    const document = object(raw, [
      "slug",
      "title",
      "version",
      "effectiveAt",
      "sections",
    ]);
    if (
      !POLICY_KINDS.includes(document.slug as PolicyKind) ||
      seen.has(document.slug as PolicyKind)
    )
      return invalid();
    const slug = document.slug as PolicyKind;
    seen.add(slug);
    if (
      !Number.isSafeInteger(document.version) ||
      (document.version as number) < 1
    )
      return invalid();
    const effectiveAt = text(document.effectiveAt, 24);
    // The server selects effective publications and emits UTC ISO timestamps.
    // Client clock skew must not decide whether server-published text is effective.
    const time = new Date(effectiveAt);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(effectiveAt) ||
      !Number.isFinite(time.getTime()) ||
      time.toISOString() !== effectiveAt
    )
      return invalid();
    if (JSON.stringify(document.sections).length > 150000) return invalid();
    const ids = new Set<string>();
    const sections = array(document.sections, 50).map((rawSection) => {
      const section = object(rawSection, ["id", "heading", "blocks"]);
      const id = text(section.id, 80);
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) return invalid();
      ids.add(id);
      const blocks = array(section.blocks, 100).map((rawBlock): PolicyBlock => {
        if (
          rawBlock &&
          typeof rawBlock === "object" &&
          "type" in rawBlock &&
          rawBlock.type === "paragraph"
        ) {
          const block = object(rawBlock, ["type", "text"]);
          return { type: "paragraph", text: text(block.text, 10000) };
        }
        const block = object(rawBlock, ["type", "ordered", "items"]);
        if (block.type !== "list" || typeof block.ordered !== "boolean")
          return invalid();
        return {
          type: "list",
          ordered: block.ordered,
          items: array(block.items, 100).map((item) => text(item, 2000)),
        };
      });
      return { id, heading: text(section.heading, 200), blocks };
    });
    return {
      slug,
      title: text(document.title, 200),
      version: document.version as number,
      effectiveAt,
      sections,
    };
  });
}

export class PublishedPolicyApi implements PublishedPolicyGateway {
  constructor(
    private readonly origin: string,
    private readonly session: Pick<
      CustomerSessionController,
      "withCredentials"
    >,
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private readonly timeoutMs = 15000,
  ) {}

  async listPublished(signal: AbortSignal): Promise<PublishedPolicyDocument[]> {
    signal.throwIfAborted();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: () => void = () => {};
    const deadline = new Promise<never>((_, reject) => {
      cancel = () => {
        reject(new DOMException("Policy read cancelled", "AbortError"));
        controller.abort();
      };
      signal.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => {
        reject(new ApiClientError("retryable", "REQUEST_TIMEOUT"));
        controller.abort();
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([
        deadline,
        this.session.withCredentials(async () => {
          controller.signal.throwIfAborted();
          let response: Response;
          try {
            response = await this.fetcher(
              `${this.origin}/api/v1/customer/legal-policies`,
              {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                redirect: "error",
                headers: { Accept: "application/json" },
                signal: controller.signal,
              },
            );
          } catch {
            controller.signal.throwIfAborted();
            throw new ApiClientError("offline", "NETWORK_ERROR");
          }
          if (response.status === 401)
            throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
          if (!response.ok)
            throw new ApiClientError(
              response.status >= 500 ||
                response.status === 408 ||
                response.status === 429
                ? "retryable"
                : "unrecoverable",
              "POLICIES_UNAVAILABLE",
            );
          try {
            return parsePublishedPolicyEnvelope(await response.json());
          } catch {
            return invalid();
          }
        }),
      ]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
  }
}
