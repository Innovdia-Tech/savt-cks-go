import { describe, expect, it } from "vitest";
import {
  DevelopmentCurrentLocation,
  DevelopmentLocationSearch,
} from "./development";

describe("synthetic location fixtures", () => {
  const api = new DevelopmentLocationSearch();
  const signal = new AbortController().signal;
  it("shows several distinct candidates and resolves only the one selected", async () => {
    const suggestions = await api.search("ITCC", "session", signal);
    expect(suggestions).toHaveLength(3);
    expect(new Set(suggestions.map((item) => item.placeId)).size).toBe(3);
    const place = await api.resolve(suggestions[1]!.placeId, "session", signal);
    expect(place.placeId).toBe(suggestions[1]!.placeId);
  });
  it("supplies deterministic empty and unavailable states", async () => {
    await expect(api.search("nowhere", "session", signal)).resolves.toEqual([]);
    await expect(
      api.search("unavailable", "session", signal),
    ).rejects.toThrow();
  });
});

describe("synthetic current location", () => {
  it("returns coordinates only when requested and supports denied and unavailable fixtures", async () => {
    const port = new DevelopmentCurrentLocation();
    await expect(port.requestCurrentLocation()).resolves.toMatchObject({
      latitude: 5.9186,
      longitude: 116.0818,
    });
    port.setMode("denied");
    await expect(port.requestCurrentLocation()).rejects.toMatchObject({
      kind: "denied",
    });
    port.setMode("unavailable");
    await expect(port.requestCurrentLocation()).rejects.toMatchObject({
      kind: "unavailable",
    });
  });
});
