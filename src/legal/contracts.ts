export const POLICY_KINDS = [
  "terms",
  "delivery",
  "cancellation-refund",
  "privacy",
] as const;
export type PolicyKind = (typeof POLICY_KINDS)[number];
export const POLICY_TITLES: Record<PolicyKind, string> = {
  terms: "Terms & Conditions",
  delivery: "Delivery Policy",
  "cancellation-refund": "Cancellation & Refund Policy",
  privacy: "Privacy Notice",
};

export type PublishedPolicy = {
  kind: PolicyKind;
  version: string;
  effectiveAt: string;
  publishedAt: string;
  status: "published";
  content: string;
};
export type RequiredRequirement = {
  mode: "required";
  enforcementReady: true;
  requirementId: string;
  checkoutAttemptId: string;
  quoteId: string;
  expiresAt: string;
  policies: PublishedPolicy[];
};
export type Requirement = { mode: "inactive" } | RequiredRequirement;
export type AcceptanceRequest = {
  quoteId: string;
  checkoutAttemptId: string;
  requirementId: string;
  policies: Array<{ kind: PolicyKind; version: string }>;
  accepted: true;
};
export type Receipt = AcceptanceRequest & {
  acceptanceId: string;
  acceptedAt: string;
  expiresAt: string;
};
export interface PolicyGateway {
  listPublished(signal: AbortSignal): Promise<unknown>;
  checkoutRequirement(quoteId: string, signal: AbortSignal): Promise<unknown>;
  recordAcceptance(
    request: AcceptanceRequest,
    signal: AbortSignal,
  ): Promise<unknown>;
}

function invalid(): never {
  throw new Error("Invalid published policy or acceptance response");
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) invalid();
  return value;
}

function kind(value: unknown): PolicyKind {
  if (!POLICY_KINDS.includes(value as PolicyKind)) invalid();
  return value as PolicyKind;
}

// Require a complete timestamp with a timezone. Date.parse alone normalizes
// impossible dates such as February 30 rather than rejecting them.
function timestamp(value: unknown): string {
  const result = text(value);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(
      result,
    );
  if (!match) invalid();
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] =
    match;
  const y = Number(year);
  const m = Number(month);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    m < 1 ||
    m > 12 ||
    Number(day) < 1 ||
    Number(day) > monthDays[m - 1] ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    Number(offsetHour ?? 0) > 23 ||
    Number(offsetMinute ?? 0) > 59 ||
    !Number.isFinite(Date.parse(result))
  )
    invalid();
  return result;
}

export function parsePublishedPolicies(
  value: unknown,
  now = Date.now(),
): PublishedPolicy[] {
  if (
    !Array.isArray(value) ||
    value.length > POLICY_KINDS.length ||
    !Number.isFinite(now)
  )
    invalid();
  const seen = new Set<PolicyKind>();
  return value.map((entry) => {
    const data = object(entry);
    const policyKind = kind(data.kind);
    if (seen.has(policyKind) || data.status !== "published") invalid();
    seen.add(policyKind);
    const effectiveAt = timestamp(data.effectiveAt);
    const publishedAt = timestamp(data.publishedAt);
    if (Date.parse(effectiveAt) > now || Date.parse(publishedAt) > now)
      invalid();
    return {
      kind: policyKind,
      version: text(data.version),
      effectiveAt,
      publishedAt,
      status: "published",
      content: text(data.content),
    };
  });
}

export function parseRequirement(
  value: unknown,
  quoteId: string,
  now = Date.now(),
): Requirement {
  const data = object(value);
  if (!Number.isFinite(now) || !quoteId.trim()) invalid();
  if (data.mode === "inactive") {
    if (Object.keys(data).some((key) => key !== "mode")) invalid();
    return { mode: "inactive" };
  }
  if (
    data.mode !== "required" ||
    data.enforcementReady !== true ||
    data.quoteId !== quoteId
  )
    invalid();
  const expiresAt = timestamp(data.expiresAt);
  if (Date.parse(expiresAt) <= now) invalid();
  const policies = parsePublishedPolicies(data.policies, now);
  if (policies.length !== POLICY_KINDS.length) invalid();
  return {
    mode: "required",
    enforcementReady: true,
    requirementId: text(data.requirementId),
    checkoutAttemptId: text(data.checkoutAttemptId),
    quoteId,
    expiresAt,
    policies,
  };
}

export function parseReceipt(
  value: unknown,
  required: RequiredRequirement,
  now = Date.now(),
): Receipt {
  const data = object(value);
  if (
    !Number.isFinite(now) ||
    data.accepted !== true ||
    data.quoteId !== required.quoteId ||
    data.checkoutAttemptId !== required.checkoutAttemptId ||
    data.requirementId !== required.requirementId ||
    !Array.isArray(data.policies) ||
    data.policies.length !== POLICY_KINDS.length
  )
    invalid();
  const acceptedAt = timestamp(data.acceptedAt);
  const expiresAt = timestamp(data.expiresAt);
  if (
    Date.parse(acceptedAt) > now ||
    Date.parse(expiresAt) <= now ||
    Date.parse(expiresAt) > Date.parse(required.expiresAt) ||
    Date.parse(required.expiresAt) <= now
  )
    invalid();
  const seen = new Set<PolicyKind>();
  const policies = data.policies.map((entry) => {
    const policy = object(entry);
    const policyKind = kind(policy.kind);
    const version = text(policy.version);
    if (
      seen.has(policyKind) ||
      !required.policies.some(
        (document) =>
          document.kind === policyKind && document.version === version,
      )
    )
      invalid();
    seen.add(policyKind);
    return { kind: policyKind, version };
  });
  return {
    acceptanceId: text(data.acceptanceId),
    accepted: true,
    acceptedAt,
    expiresAt,
    quoteId: required.quoteId,
    checkoutAttemptId: required.checkoutAttemptId,
    requirementId: required.requirementId,
    policies,
  };
}
