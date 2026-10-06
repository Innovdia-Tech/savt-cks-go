export function isSafeExternalUrl(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !/^https:\/\//i.test(value) ||
    /[\s\\\u0000-\u001f\u007f]/.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.href.length <= 2048 &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

type ExternalEnvironment = {
  channel?: { postMessage(message: string): void };
  open(url: string, target: string, features: string): unknown;
};

export function openExternalWebsite(
  url: string,
  embedded: boolean,
  environment: ExternalEnvironment = {
    channel: window.SavtCksGoBridge,
    open: (url, target, features) => window.open(url, target, features),
  },
): boolean {
  if (!isSafeExternalUrl(url)) return false;
  try {
    if (embedded) {
      if (!environment.channel) return false;
      environment.channel.postMessage(
        JSON.stringify({ type: "external-link-handoff", payload: { url } }),
      );
    } else {
      environment.open(url, "_blank", "noopener,noreferrer");
    }
    return true;
  } catch {
    return false;
  }
}
