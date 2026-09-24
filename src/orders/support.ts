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
  const message = `Hi CKS Go Support, I need help with my order ${orderNumber}.\nMy enquiry:`;
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
  open: ExternalOpener = (url, target, features) =>
    window.open(url, target, features),
): boolean {
  const url = buildOrderSupportUrl(digits, orderNumber);
  if (!url) return false;
  open(url, "_blank", "noopener,noreferrer");
  return true;
}
