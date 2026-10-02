import type { DataState } from "./state";
export function CustomerNotice({
  notice,
  noticeKind,
}: Pick<DataState, "notice" | "noticeKind">) {
  if (!notice) return null;
  return (
    <p
      className={
        noticeKind === "persistent"
          ? "catalogue-notice"
          : "customer-status-toast"
      }
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {noticeKind === "success" && (
        <span className="customer-status-toast__check" aria-hidden="true">
          ✓
        </span>
      )}
      {notice}
    </p>
  );
}
