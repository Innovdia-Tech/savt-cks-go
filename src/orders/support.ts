const internationalPhone = /^\+[1-9]\d{7,14}$/;
const recipientDigits = /^[1-9]\d{7,14}$/;

export function parseSupportWhatsApp(raw: string): string {
  const value = raw.trim();
  return internationalPhone.test(value) ? value.slice(1) : "";
}

export function buildOrderSupportUrl(
  digits: string,
  orderNumber: string,
): string | null {
  if (!recipientDigits.test(digits)) return null;
  if (!/^(?:CKS|CKSGO)-[A-Za-z0-9-]{1,114}$/.test(orderNumber)) return null;
  const message = `Hi CKS Go Support, I need help with my order ${orderNumber}.\n\nMy enquiry:`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

type ExternalOpener = (
  url: string,
  target: string,
  features: string,
) => unknown;

export function openOrderSupport(
  digits: string,
  orderNumber: string,
  open: ExternalOpener = openSupportExternally,
): boolean {
  const url = buildOrderSupportUrl(digits, orderNumber);
  if (!url) return false;
  return openGeneratedSupport(url, open);
}

export function buildGeneralSupportUrl(digits: string): string | null {
  if (!recipientDigits.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent("Hi CKS Go Support, I need some help.\n\nMy enquiry:")}`;
}

export function openGeneralSupport(
  digits: string,
  open: ExternalOpener = openSupportExternally,
): boolean {
  return openGeneratedSupport(buildGeneralSupportUrl(digits), open);
}

// This path is private: callers provide a recipient and order number, never a URL.
function openGeneratedSupport(
  url: string | null,
  open: ExternalOpener,
): boolean {
  if (!url) return false;
  try {
    open(url, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}

function openSupportExternally(
  url: string,
  target: string,
  features: string,
): unknown {
  if (window.SavtCksGoBridge) {
    window.SavtCksGoBridge.postMessage(
      JSON.stringify({
        type: "support-handoff",
        payload: { whatsappUrl: url },
      }),
    );
    return;
  }
  return window.open(url, target, features);
}
