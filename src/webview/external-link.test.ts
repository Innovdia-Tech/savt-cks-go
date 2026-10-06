import { describe, expect, it, vi } from "vitest";
import { isSafeExternalUrl, openExternalWebsite } from "./external-link";

describe("advertisement external websites", () => {
  it("bounds the encoded destination as well as its raw text", () => {
    expect(isSafeExternalUrl("https://cks.example/" + "界".repeat(300))).toBe(
      false,
    );
  });
  it.each([
    "http://cks.example",
    "https://user@cks.example",
    "javascript:alert(1)",
    "file:///tmp/a",
    "custom://cks.example",
    "/relative",
    "https://cks.example/" + "a".repeat(2048),
  ])("rejects %s", (url) => expect(isSafeExternalUrl(url)).toBe(false));
  it("opens standalone HTTPS with no opener or referrer", () => {
    const open = vi.fn();
    expect(openExternalWebsite("https://cks.example/a", false, { open })).toBe(
      true,
    );
    expect(open).toHaveBeenCalledWith(
      "https://cks.example/a",
      "_blank",
      "noopener,noreferrer",
    );
  });
  it("posts an exact embedded message without opening or replacing the WebView", () => {
    const open = vi.fn(),
      postMessage = vi.fn();
    expect(
      openExternalWebsite("https://cks.example/a", true, {
        open,
        channel: { postMessage },
      }),
    ).toBe(true);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      type: "external-link-handoff",
      payload: { url: "https://cks.example/a" },
    });
    expect(open).not.toHaveBeenCalled();
  });
  it("fails safely without embedded bridge and on opener errors", () => {
    const open = vi.fn(() => {
      throw Error("private error");
    });
    expect(openExternalWebsite("https://cks.example", true, { open })).toBe(
      false,
    );
    expect(open).not.toHaveBeenCalled();
    expect(openExternalWebsite("https://cks.example", false, { open })).toBe(
      false,
    );
    expect(openExternalWebsite("http://cks.example", false, { open })).toBe(
      false,
    );
  });
});
