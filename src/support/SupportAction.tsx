import { useId, useState } from "react";
import { Button } from "../components/ui";
import { HelpIcon } from "./HelpIcon";
import {
  buildGeneralSupportUrl,
  buildOrderSupportUrl,
  openGeneralSupport,
  openOrderSupport,
} from "../orders/support";

export function SupportAction({
  digits,
  orderNumber,
  context = "home",
}: {
  digits: string;
  orderNumber?: string;
  context?: "home" | "orders" | "delivery" | "payment";
}) {
  const [failed, setFailed] = useState(false);
  const available = orderNumber
    ? buildOrderSupportUrl(digits, orderNumber)
    : buildGeneralSupportUrl(digits);
  const descriptionId = useId();
  if (!available) return null;
  const prompt = orderNumber
    ? null
    : context === "delivery"
      ? "Need help with your delivery address?"
      : "Need help?";
  return (
    <div
      className={`support-action support-action--${orderNumber ? "order" : context}`}
    >
      <div className="support-action__row">
        {prompt && <span className="support-action__prompt">{prompt}</span>}
        <Button
          variant="tertiary"
          aria-label={
            orderNumber
              ? `Open WhatsApp support for order ${orderNumber}`
              : "Open CKS Go support in WhatsApp"
          }
          aria-describedby={descriptionId}
          onClick={() =>
            setFailed(
              !(orderNumber
                ? openOrderSupport(digits, orderNumber)
                : openGeneralSupport(digits)),
            )
          }
        >
          <HelpIcon />
          {!orderNumber && (context === "home" || context === "orders")
            ? "Get help"
            : "Get help on WhatsApp"}
        </Button>
      </div>
      <span id={descriptionId} className="sr-only">
        Opens WhatsApp to contact CKS Go support.
      </span>
      {failed && (
        <p role="status">We couldn't open WhatsApp. Please try again.</p>
      )}
    </div>
  );
}
