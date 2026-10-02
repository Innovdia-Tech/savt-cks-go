import { useState } from "react";
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
}: {
  digits: string;
  orderNumber?: string;
}) {
  const [failed, setFailed] = useState(false);
  const available = orderNumber
    ? buildOrderSupportUrl(digits, orderNumber)
    : buildGeneralSupportUrl(digits);
  const descriptionId = orderNumber
    ? "order-support-description"
    : "general-support-description";
  return (
    <div className="support-action">
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
        {orderNumber ? "WhatsApp support" : "Get help"}
      </Button>
      <p id={descriptionId} role={!available || failed ? "status" : undefined}>
        {!available || failed
          ? "WhatsApp support is unavailable right now."
          : "Opens WhatsApp to contact CKS Go support."}
      </p>
    </div>
  );
}
