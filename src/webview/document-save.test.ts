import { afterEach, expect, it, vi } from "vitest";
import { requestDocumentSave } from "./document-save";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const target = new EventTarget();
  const sent: unknown[] = [];
  vi.stubGlobal("window", {
    SavtCksGoBridge: {
      postMessage: (message: string) => sent.push(JSON.parse(message)),
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  });
  vi.stubGlobal("crypto", { randomUUID: () => id });
  return {
    sent,
    result: (detail: unknown) =>
      target.dispatchEvent(
        new CustomEvent("savt-cks-go-document-result", { detail }),
      ),
  };
}
it.each([
  { protocolVersion: "2", requestId: id, status: "saved" },
  {
    protocolVersion: "1",
    requestId: id,
    status: "saved",
    path: "/Downloads/Receipt.pdf",
  },
  { protocolVersion: "1", requestId: id, status: "other" },
  null,
])("rejects malformed native result %#", async (detail) => {
  const { sent, result } = setup();
  const pending = requestDocumentSave(blob, "Receipt.pdf");
  const rejected = expect(pending).rejects.toMatchObject({ kind: "invalid" });
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  result(detail);
  await rejected;
});
it.each(["saved", "failed"])(
  "waits for user-paced native %s beyond 20 seconds",
  async (status) => {
    vi.useFakeTimers();
    const { sent, result } = setup();
    const pending = requestDocumentSave(blob, "Receipt.pdf");
    let completed = false;
    const outcome = pending.then(
      () => {
        completed = true;
        return "saved";
      },
      () => {
        completed = true;
        return "failed";
      },
    );
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    result({
      protocolVersion: "1",
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "saved",
    });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(completed).toBe(false);
    result({ protocolVersion: "1", requestId: id, status });
    expect(await outcome).toBe(status);
  },
);
it("accepts exact maximum decoded size", async () => {
  const { sent, result } = setup();
  const maximum = new Blob(["%PDF-", new Uint8Array(2097152 - 5)], {
    type: "application/pdf",
  });
  const pending = requestDocumentSave(maximum, "Receipt.pdf");
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  result({ protocolVersion: "1", requestId: id, status: "saved" });
  await expect(pending).resolves.toBeUndefined();
});
it("bridge transport failure rejects nonfatally", async () => {
  setup();
  window.SavtCksGoBridge!.postMessage = () => {
    throw new Error("native unavailable");
  };
  await expect(requestDocumentSave(blob, "Receipt.pdf")).rejects.toMatchObject({
    kind: "unavailable",
  });
});
