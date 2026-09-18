export type Profile = {
  id: string;
  savtMemberId: string | null;
  nameSnapshot: string | null;
  phoneE164Snapshot: string | null;
  membershipTier: "BASIC" | "SILVER" | "GOLD" | "PLATINUM" | "UNKNOWN";
  savtMemberStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "UNKNOWN";
  accountStatus: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  savtSyncStatus: "NEVER_SYNCED" | "SYNCED" | "STALE" | "FAILED";
  savtSyncedAt: string | null;
};
export const invalid = (): never => {
  throw new Error("Invalid customer response.");
};
export const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const exact = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
export const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
export const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
export const unwrap = (v: unknown): unknown =>
  record(v) && exact(v, ["data"]) ? v.data : invalid();
const nullableString = (v: unknown) => v === null || typeof v === "string";
export const parseProfile = (value: unknown): Profile => {
  const d = unwrap(value);
  if (
    !record(d) ||
    !exact(d, [
      "id",
      "savtMemberId",
      "nameSnapshot",
      "phoneE164Snapshot",
      "membershipTier",
      "savtMemberStatus",
      "accountStatus",
      "savtSyncStatus",
      "savtSyncedAt",
    ]) ||
    !uuid(d.id) ||
    !nullableString(d.savtMemberId) ||
    !nullableString(d.nameSnapshot) ||
    !nullableString(d.phoneE164Snapshot) ||
    typeof d.savtSyncStatus !== "string" ||
    typeof d.accountStatus !== "string" ||
    typeof d.savtMemberStatus !== "string" ||
    typeof d.membershipTier !== "string" ||
    !["BASIC", "SILVER", "GOLD", "PLATINUM", "UNKNOWN"].includes(
      String(d.membershipTier),
    ) ||
    !["ACTIVE", "INACTIVE", "SUSPENDED", "UNKNOWN"].includes(
      String(d.savtMemberStatus),
    ) ||
    !["ACTIVE", "SUSPENDED", "DEACTIVATED"].includes(String(d.accountStatus)) ||
    !["NEVER_SYNCED", "SYNCED", "STALE", "FAILED"].includes(
      String(d.savtSyncStatus),
    ) ||
    !(d.savtSyncedAt === null || date(d.savtSyncedAt))
  )
    return invalid();
  return { ...d } as Profile;
};
