import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserDeliveryLocationPort } from "./bridge";
import { DeliveryLocationError } from "./contracts";

describe("BrowserDeliveryLocationPort", () => {
  beforeEach(() => vi.stubGlobal("window", new EventTarget()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("expires a stalled request and ignores late native completion", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    window.SavtCksGoBridge = { postMessage };
    const port = new BrowserDeliveryLocationPort(100);
    const result = expect(port.searchLocation("Penampang")).rejects.toEqual(
      new DeliveryLocationError("timeout"),
    );
    await vi.advanceTimersByTimeAsync(100);
    await result;
    const request = JSON.parse(postMessage.mock.calls[0][0]);
    expect(() =>
      window.dispatchEvent(
        new CustomEvent("savt-cks-go-location", {
          detail: { ...request, status: "ok" },
        }),
      ),
    ).not.toThrow();
    port.dispose();
  });
  it("disposal rejects pending requests without retaining a location listener", async () => {
    window.SavtCksGoBridge = { postMessage: vi.fn() };
    const port = new BrowserDeliveryLocationPort();
    const result = expect(port.requestCurrentLocation()).rejects.toEqual(
      new DeliveryLocationError("unavailable"),
    );
    port.dispose();
    await result;
  });
  it("rejects malformed failure payloads instead of treating them as permission denial", async () => {
    let sent: { requestId: string };
    window.SavtCksGoBridge = {
      postMessage: (message) => {
        sent = JSON.parse(message);
      },
    };
    const port = new BrowserDeliveryLocationPort();
    const pending = port.requestCurrentLocation();
    window.dispatchEvent(
      new CustomEvent("savt-cks-go-location", {
        detail: {
          protocolVersion: "1",
          requestId: sent!.requestId,
          status: "denied",
          latitude: 91,
          longitude: null,
          formattedAddress: null,
          addressLine1: null,
          city: null,
          state: null,
          postcode: null,
        },
      }),
    );
    await expect(pending).rejects.toEqual(new DeliveryLocationError("invalid"));
    port.dispose();
  });
  it("fails address search closed when the trusted native bridge is unavailable", async () => {
    const original = window.SavtCksGoBridge;
    delete window.SavtCksGoBridge;
    await expect(
      new BrowserDeliveryLocationPort().searchLocation("Kobusak Perdana"),
    ).rejects.toEqual(new DeliveryLocationError("unavailable"));
    window.SavtCksGoBridge = original;
  });

  it("sends only the bounded current-location bridge request", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    window.SavtCksGoBridge = { postMessage };
    const port = new BrowserDeliveryLocationPort(1_000);
    const pending = port.requestCurrentLocation();
    const sent = JSON.parse(postMessage.mock.calls[0]![0]);
    expect(sent).toEqual({
      type: "location-current",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      protocolVersion: "1",
    });
    window.dispatchEvent(
      new CustomEvent("savt-cks-go-location", {
        detail: {
          protocolVersion: "1",
          requestId: sent.requestId,
          status: "ok",
          latitude: 5.95,
          longitude: 116.07,
          formattedAddress: "Kota Kinabalu, Sabah",
          addressLine1: "Jalan Example",
          city: "Kota Kinabalu",
          state: "Sabah",
          postcode: "88000",
        },
      }),
    );
    await expect(pending).resolves.toMatchObject({
      latitude: 5.95,
      longitude: 116.07,
      city: "Kota Kinabalu",
      state: "Sabah",
    });
    vi.useRealTimers();
  });
});
