import { BridgeError } from "./bridge";

const maxBytes = 2 * 1024 * 1024;
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventName = "savt-cks-go-document-result";

export const hasDocumentSaveBridge = () =>
  typeof window !== "undefined" && !!window.SavtCksGoBridge;

export async function requestDocumentSave(
  blob: Blob,
  filename: string,
): Promise<void> {
  const channel = window.SavtCksGoBridge;
  if (!channel) throw new BridgeError("unavailable");
  if (
    blob.type !== "application/pdf" ||
    blob.size < 5 ||
    blob.size > maxBytes ||
    filename.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9 _-]*\.pdf$/.test(filename)
  )
    throw new BridgeError("invalid");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (
    bytes.length !== blob.size ||
    new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
  )
    throw new BridgeError("invalid");
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const requestId = crypto.randomUUID();
  if (!uuidV4.test(requestId)) throw new BridgeError("invalid");
  // Explicit fields only: the authorized file is the entire document boundary.
  const payload = {
    protocolVersion: "1",
    requestId,
    filename,
    mimeType: "application/pdf",
    base64: btoa(binary),
  };
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: BridgeError) => {
      if (settled) return;
      settled = true;
      window.removeEventListener(eventName, listener);
      if (error) reject(error);
      else resolve();
    };
    const listener: EventListener = (event) => {
      const detail: unknown =
        event instanceof CustomEvent ? event.detail : undefined;
      if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
        finish(new BridgeError("invalid"));
        return;
      }
      const value = detail as Record<string, unknown>;
      if (value.requestId !== requestId) return;
      if (
        Object.keys(value).length !== 3 ||
        !["protocolVersion", "requestId", "status"].every((key) =>
          Object.hasOwn(value, key),
        ) ||
        value.protocolVersion !== "1" ||
        (value.status !== "saved" && value.status !== "failed")
      ) {
        finish(new BridgeError("invalid"));
        return;
      }
      finish(
        value.status === "failed" ? new BridgeError("unavailable") : undefined,
      );
    };
    // The legacy Android document picker is user-paced. Only its terminal
    // native result can declare the save complete or failed.
    window.addEventListener(eventName, listener);
    try {
      channel.postMessage(JSON.stringify({ type: "document-save", payload }));
    } catch {
      finish(new BridgeError("unavailable"));
    }
  });
}
