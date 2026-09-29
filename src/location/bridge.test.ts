import { describe, expect, it, vi } from "vitest";
import { BrowserDeliveryLocationPort, DeliveryLocationError } from "./bridge";

describe("BrowserDeliveryLocationPort", () => {
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
