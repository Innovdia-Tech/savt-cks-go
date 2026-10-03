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
