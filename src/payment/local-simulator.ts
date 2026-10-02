const simulatorPath = "/api/integrations/cks-go/v1/payment-simulator/";

export const isLocalPaymentSimulatorOrigin = (
  value: unknown,
): value is string => {
  if (typeof value !== "string") return false;
  const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(value);
  return match?.[0] === value && Number(match[1]) <= 65_535;
};

export const isLocalPaymentSimulatorBrowserEnabled = (): boolean =>
  import.meta.env.DEV === true &&
  import.meta.env.PROD === false &&
  isLocalPaymentSimulatorOrigin(
    import.meta.env.VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN,
  ) &&
  typeof window !== "undefined" &&
  !!window.location &&
  /^http:\/\/127\.0\.0\.1(?::[1-9]\d{0,4})?\//.test(window.location.href);

export const isLocalPaymentSimulatorCheckoutUrl = (
  value: unknown,
): value is string => {
  if (!isLocalPaymentSimulatorBrowserEnabled() || typeof value !== "string")
    return false;
  const prefix =
    import.meta.env.VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN + simulatorPath;
  if (!value.startsWith(prefix)) return false;
  const reference = value.slice(prefix.length);
  return reference.length === 43 && /^[A-Za-z0-9_-]{43}$/.test(reference);
};
