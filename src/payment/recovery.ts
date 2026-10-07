import { uuid } from "../customer/contracts";

type RecoveryLocation = Pick<Location, "hash" | "pathname" | "search">;

// Native navigation supplies identity only. This is consumed before rendering,
// then checked through the scoped CKS backend after authentication.
export function consumePaymentRecoveryFragment(
  embeddedHost: boolean,
  location: RecoveryLocation,
  history: Pick<History, "replaceState">,
): string | null {
  const prefix = "#cks-go-payment-return=";
  if (!embeddedHost || !location.hash.startsWith(prefix)) return null;
  const id = location.hash.slice(prefix.length);
  history.replaceState(null, "", `${location.pathname}${location.search}#cart`);
  return uuid(id) ? id : null;
}
