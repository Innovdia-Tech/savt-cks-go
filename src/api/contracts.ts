export type BootstrapData = {
  protocolVersion: "1";
  launchRequestId: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  expiresAt: string;
};

export type SessionData = {
  authenticated: true;
  expiresAt: string;
  csrfToken: string;
};

export type ApiErrorData = {
  code: string;
  message: string;
  requestId?: string;
};

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const opaque43 = /^[A-Za-z0-9_-]{43}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

const isDateTime = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

const invalidResponse = (): never => {
  throw new Error("Invalid customer API response.");
};

const envelopeData = (value: unknown): Record<string, unknown> => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["data"]) ||
    !isRecord(value.data)
  )
    return invalidResponse();
  return value.data;
};

export const parseBootstrapEnvelope = (value: unknown): BootstrapData => {
  const data = envelopeData(value);
  if (
    !hasExactKeys(data, [
      "protocolVersion",
      "launchRequestId",
      "state",
      "codeChallenge",
      "codeChallengeMethod",
      "expiresAt",
    ]) ||
    data.protocolVersion !== "1" ||
    typeof data.launchRequestId !== "string" ||
    !uuidV4.test(data.launchRequestId) ||
    typeof data.state !== "string" ||
    !opaque43.test(data.state) ||
    typeof data.codeChallenge !== "string" ||
    !opaque43.test(data.codeChallenge) ||
    data.codeChallengeMethod !== "S256" ||
    !isDateTime(data.expiresAt)
  ) {
    return invalidResponse();
  }
  return data as BootstrapData;
};

export const parseSessionEnvelope = (value: unknown): SessionData => {
  const data = envelopeData(value);
  if (
    !hasExactKeys(data, ["authenticated", "expiresAt", "csrfToken"]) ||
    data.authenticated !== true ||
    !isDateTime(data.expiresAt) ||
    typeof data.csrfToken !== "string" ||
    !opaque43.test(data.csrfToken)
  ) {
    return invalidResponse();
  }
  return data as SessionData;
};

export const parseApiErrorEnvelope = (value: unknown): ApiErrorData | null => {
  if (
    !isRecord(value) ||
    (!hasExactKeys(value, ["error"]) &&
      !hasExactKeys(value, ["error", "meta"])) ||
    !isRecord(value.error)
  )
    return null;
  const { error } = value;
  if (
    (!hasExactKeys(error, ["code", "message"]) &&
      !hasExactKeys(error, ["code", "message", "fieldErrors"])) ||
    typeof error.code !== "string" ||
    typeof error.message !== "string"
  )
    return null;
  if (Object.hasOwn(error, "fieldErrors")) {
    if (!isRecord(error.fieldErrors)) return null;
    const validFieldErrors = Object.values(error.fieldErrors).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    );
    if (!validFieldErrors) return null;
  }
  const meta = value.meta;
  if (
    meta !== undefined &&
    (!isRecord(meta) ||
      !hasExactKeys(meta, ["requestId"]) ||
      typeof meta.requestId !== "string")
  )
    return null;
  const requestId =
    typeof meta?.requestId === "string" ? meta.requestId : undefined;
  return requestId
    ? { code: error.code, message: error.message, requestId }
    : { code: error.code, message: error.message };
};
