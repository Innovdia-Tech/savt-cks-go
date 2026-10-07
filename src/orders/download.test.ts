import { afterEach, describe, expect, it, vi } from "vitest";
import * as components from "./components";
const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("browser receipt attachment", () => {
  it("downloads a credential-free object URL and releases it after the browser can consume it", async () => {
    vi.useFakeTimers();
    let clicked = false;
    let attached = false;
    let removed = false;
    let revoked = "";
    const link = {
      href: "",
      download: "",
      rel: "",
      click: () => {
        expect(attached).toBe(true);
        clicked = true;
      },
      remove: () => {
        removed = true;
      },
    };
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:local-receipt",
      revokeObjectURL: (url: string) => {
        revoked = url;
      },
    });
    vi.stubGlobal("document", {
      createElement: () => link,
      body: {
        appendChild: () => {
          attached = true;
        },
      },
    });
    const save = (
      components as unknown as {
        saveReceipt: (controller: unknown, payment?: boolean) => Promise<void>;
      }
    ).saveReceipt;
    expect(save).toBeTypeOf("function");
    await save(
      {
        downloadPaymentReceipt: async () => ({
          blob,
          filename: "Payment-Receipt.pdf",
        }),
        reportReceiptSaveFailure: () => {
          throw new Error("unexpected failure");
        },
      },
      true,
    );
    expect(clicked).toBe(true);
    expect(link.href).toBe("blob:local-receipt");
    expect(link.download).toBe("Payment-Receipt.pdf");
    expect(removed).toBe(true);
    expect(revoked).toBe("");
    vi.runAllTimers();
    expect(revoked).toBe("blob:local-receipt");
  });
  it("returns a browser save failure to the owning receipt retry state", async () => {
    let failed: boolean | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        throw new Error("private platform details");
      },
    });
    const save = (
      components as unknown as {
        saveReceipt: (controller: unknown, payment?: boolean) => Promise<void>;
      }
    ).saveReceipt;
    expect(save).toBeTypeOf("function");
    await expect(
      save(
        {
          downloadPaymentReceipt: async () => ({
            blob,
            filename: "Payment-Receipt.pdf",
          }),
          reportReceiptSaveFailure: (payment: boolean) => {
            failed = payment;
          },
        },
        true,
      ),
    ).resolves.toBeUndefined();
    expect(failed).toBe(true);
  });
});

describe("embedded receipt saving", () => {
  const requestId = "11111111-1111-4111-8111-111111111111";
  function host() {
    const events = new EventTarget();
    const messages: Record<string, any>[] = [];
    vi.stubGlobal("window", {
      SavtCksGoBridge: {
        postMessage: (message: string) => messages.push(JSON.parse(message)),
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    });
    vi.stubGlobal("crypto", { randomUUID: () => requestId });
    vi.stubGlobal("document", {
      createElement: () => {
        throw new Error("embedded anchor download");
      },
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        throw new Error("embedded object URL");
      },
    });
    const result = (status: unknown, extra = {}) =>
      events.dispatchEvent(
        new CustomEvent("savt-cks-go-document-result", {
          detail: { protocolVersion: "1", requestId, status, ...extra },
        }),
      );
    return { messages, result };
  }
  it.each([true, false])(
    "saves payment=%s bytes only and waits for one native result",
    async (payment) => {
      const { messages, result } = host();
      const completed: boolean[] = [];
      const failed: boolean[] = [];
      const download = async (wait?: boolean) => {
        expect(wait).toBe(true);
        return {
          blob,
          filename: payment ? "Payment-Receipt.pdf" : "Final-Receipt.pdf",
          completeSave: (saved: boolean) => completed.push(saved),
        };
      };
      const pending = components.saveReceipt(
        {
          downloadPaymentReceipt: download,
          downloadReceipt: download,
          reportReceiptSaveFailure: (value: boolean) => failed.push(value),
        } as any,
        payment,
      );
      await vi.waitFor(() => expect(messages).toHaveLength(1));
      expect(messages[0]).toEqual({
        type: "document-save",
        payload: {
          protocolVersion: "1",
          requestId,
          filename: payment ? "Payment-Receipt.pdf" : "Final-Receipt.pdf",
          mimeType: "application/pdf",
          base64: "JVBERi0xLjc=",
        },
      });
      expect(completed).toEqual([]);
      result("saved");
      await pending;
      result("saved");
      result("failed");
      expect(completed).toEqual([true]);
      expect(failed).toEqual([]);
    },
  );
  it.each(["failed", "invalid"])(
    "returns %s native result to receipt retry state",
    async (status) => {
      const { messages, result } = host();
      const completed: boolean[] = [];
      const pending = components.saveReceipt(
        {
          downloadPaymentReceipt: async () => ({
            blob,
            filename: "Payment.pdf",
            completeSave: (saved: boolean) => completed.push(saved),
          }),
          reportReceiptSaveFailure: () => {
            throw new Error("unfenced failure");
          },
        } as any,
        true,
      );
      await vi.waitFor(() => expect(messages).toHaveLength(1));
      result(status);
      await pending;
      expect(completed).toEqual([false]);
    },
  );
  it.each([
    [new Blob(["%PDF-1.7"], { type: "text/plain" }), "Receipt.pdf"],
    [new Blob([], { type: "application/pdf" }), "Receipt.pdf"],
    [new Blob(["bad"], { type: "application/pdf" }), "Receipt.pdf"],
    [
      new Blob(["%PDF-", new Uint8Array(2 * 1024 * 1024)], {
        type: "application/pdf",
      }),
      "Receipt.pdf",
    ],
    [blob, "../Receipt.pdf"],
    [blob, "a\\Receipt.pdf"],
    [blob, "Receipt.txt"],
    [blob, "Receipt.pdf\n"],
    [blob, "a".repeat(117) + ".pdf"],
  ])(
    "rejects invalid PDF/name before sending %#",
    async (invalidBlob, filename) => {
      const { messages } = host();
      let failure = false;
      await components.saveReceipt({
        downloadReceipt: async () => ({ blob: invalidBlob, filename }),
        reportReceiptSaveFailure: () => {
          failure = true;
        },
      } as any);
      expect(failure).toBe(true);
      expect(messages).toHaveLength(0);
    },
  );
});
