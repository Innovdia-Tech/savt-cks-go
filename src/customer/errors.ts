export type DataFailure =
  | "offline"
  | "expired"
  | "retryable"
  | "conflict"
  | "limit"
  | "notFound"
  | "readOnly"
  | "validation"
  | "invalid";
export class CustomerDataError extends Error {
  constructor(
    readonly category: DataFailure,
    readonly code: string,
  ) {
    super(code);
    this.name = "CustomerDataError";
  }
}
export const failureFor = (status: number, code: string): DataFailure => {
  if (
    status === 401 ||
    code === "CUSTOMER_CSRF_INVALID" ||
    code === "CUSTOMER_SESSION_INVALID"
  )
    return "expired";
  if (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    code === "IDEMPOTENCY_REQUEST_IN_PROGRESS"
  )
    return "retryable";
  if (status === 403) return "readOnly";
  if (status === 404) return "notFound";
  if (code === "CUSTOMER_ADDRESS_LIMIT") return "limit";
  if (status === 409 || status === 412 || status === 428) return "conflict";
  if (status === 400 || status === 422) return "validation";
  return "invalid";
};
export const errorMessage = (e: CustomerDataError): string =>
  ({
    offline:
      "You’re offline. Check your connection, then retry the same request.",
    expired: "Your session has expired. Return to Savt to reopen CKS Go.",
    retryable:
      e.code === "REQUEST_TIMEOUT"
        ? "The request timed out. It may have been saved. Retry the same request to check safely."
        : "The service is temporarily unavailable or your request is still processing. Retry the same request.",
    conflict:
      "This address or request has changed. Reload the current addresses before trying again. Your changes have not overwritten the current address.",
    limit:
      "You can have up to 20 active addresses. Deactivate an address before adding or reactivating another.",
    notFound: "This address is no longer available. Reload your addresses.",
    readOnly:
      "Your account is read-only. You can view saved addresses but cannot change them.",
    validation: "Check your address fields and try again.",
    invalid:
      "We couldn’t read the customer information. Reload or try again later.",
  })[e.category];
