import { parseSupportWhatsApp } from "../orders/support";

export type RuntimeConfig = {
  apiOrigin: string;
  developmentApi: boolean;
  developmentBridge: boolean;
  supportWhatsApp: string;
};

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

const isLoopback = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname === "[::1]";

const validatedOrigin = (
  rawValue: string | undefined,
  production: boolean,
): string => {
  const value = rawValue?.trim() ?? "";
  if (!value) return "";

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RuntimeConfigurationError("Customer API origin is invalid.");
  }

  const hasOnlyOrigin =
    url.username === "" &&
    url.password === "" &&
    (url.pathname === "" || url.pathname === "/") &&
    url.search === "" &&
    url.hash === "";
  const secure = url.protocol === "https:";
  const developmentLoopback =
    !production && url.protocol === "http:" && isLoopback(url.hostname);
  if (!hasOnlyOrigin || (!secure && !developmentLoopback)) {
    throw new RuntimeConfigurationError(
      "Customer API origin must be a secure origin.",
    );
  }

  return url.origin;
};

export const loadRuntimeConfig = (
  environment: Record<string, string | boolean | undefined>,
  production: boolean,
): RuntimeConfig => {
  const developmentApi = environment.VITE_CKS_GO_DEVELOPMENT_API === "true";
  const developmentBridge =
    environment.VITE_CKS_GO_DEVELOPMENT_BRIDGE === "true";
  if (production && (developmentApi || developmentBridge)) {
    throw new RuntimeConfigurationError(
      "Development customer adapters are unavailable in production.",
    );
  }

  return {
    apiOrigin: validatedOrigin(
      String(environment.VITE_CUSTOMER_API_ORIGIN ?? ""),
      production,
    ),
    developmentApi,
    developmentBridge,
    supportWhatsApp: parseSupportWhatsApp(
      String(environment.VITE_CKS_GO_SUPPORT_WHATSAPP ?? ""),
    ),
  };
};
