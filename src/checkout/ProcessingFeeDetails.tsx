import type { ProcessingFee } from "./contracts";
import { ChevronDownIcon } from "../components/Icons";

// Both checkout and order history describe only their frozen server evidence.
export function ProcessingFeeDetails({
  fee,
}: {
  fee: ProcessingFee | undefined;
}) {
  if (fee?.feeType !== "SMALL_ORDER_TIERS") return null;
  return (
    <>
      <p>Based on items total after discounts. Delivery is excluded.</p>
      {fee.outcome === "DISABLED" ? (
        <p>Small order processing fee is disabled.</p>
      ) : (
        fee.outcome !== "CHARGED" && <p>No small order fee for this order.</p>
      )}
      <details className="quote-evidence-details">
        <summary>
          About this fee
          <ChevronDownIcon className="h-6 w-6" />
        </summary>
        <p>Only one fee applies per order.</p>
      </details>
    </>
  );
}
