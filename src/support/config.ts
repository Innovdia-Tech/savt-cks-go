import { parseSupportWhatsApp } from "../orders/support";

export function parseSupportConfig(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).length !== 1 || !Object.hasOwn(envelope, "data"))
    return "";
  const data = envelope.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const config = data as Record<string, unknown>;
  if (Object.keys(config).length !== 1 || typeof config.whatsapp !== "string")
    return "";
  return parseSupportWhatsApp(config.whatsapp);
}

export async function loadSupportWhatsApp(
  origin: string,
  fetcher: typeof fetch = globalThis.fetch,
  timeoutMs = 5000,
  external?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  external?.addEventListener("abort", abort, { once: true });
  if (external?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<string>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve("");
      }, timeoutMs);
    });
    const request = async () => {
      const response = await fetcher(`${origin}/api/v1/customer/support`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      return response.ok ? parseSupportConfig(await response.json()) : "";
    };
    return await Promise.race([request(), deadline]);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}
