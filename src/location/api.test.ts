import { describe, expect, it, vi } from "vitest";
import { parseResolvedPlace, parseSuggestions, LocationSearchApi } from "./api";
import type { CustomerSessionController } from "../session/controller";

const token = "123e4567-e89b-42d3-a456-426614174000";
const suggestion = {
  placeId: "ChIJplace123",
  primaryText: "ITCC Shopping Mall",
  secondaryText: "Penampang, Sabah, Malaysia",
  distanceMeters: null,
};
const resolved = {
  placeId: "ChIJplace123",
  formattedAddress: "ITCC, Penampang, Sabah, Malaysia",
  addressLine1: "ITCC",
  city: "Penampang",
  state: "Sabah",
  postcode: "89500",
  countryCode: "MY",
  latitude: 5.92,
  longitude: 116.08,
};
const session = {
  withCredentials: <T>(operation: (csrf: string) => Promise<T>) =>
    operation("csrf-fixture"),
} as CustomerSessionController;

describe("location search contract", () => {
  it("projects only five closed suggestions", () => {
    expect(
      parseSuggestions({ data: { suggestions: Array(5).fill(suggestion) } }),
    ).toHaveLength(5);
    expect(() =>
      parseSuggestions({
        data: { suggestions: [{ ...suggestion, secret: "x" }] },
      }),
    ).toThrow();
    expect(() =>
      parseSuggestions({ data: { suggestions: Array(6).fill(suggestion) } }),
    ).toThrow();
  });

  it("rejects malformed resolved locations and hidden provider fields", () => {
    expect(parseResolvedPlace({ data: resolved })).toEqual(resolved);
    expect(() =>
      parseResolvedPlace({ data: { ...resolved, latitude: 91 } }),
    ).toThrow();
    expect(() =>
      parseResolvedPlace({ data: { ...resolved, apiKey: "hidden" } }),
    ).toThrow();
    expect(() =>
      parseResolvedPlace({ data: { ...resolved, countryCode: "SG" } }),
    ).toThrow();
  });

  it("sends credentialed, CSRF-protected search and resolve requests with one session token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ data: { suggestions: [suggestion] } }),
      )
      .mockResolvedValueOnce(Response.json({ data: resolved }));
    const api = new LocationSearchApi("https://example.test", session, fetcher);
    expect(
      await api.search("ITCC", token, new AbortController().signal),
    ).toEqual([suggestion]);
    expect(
      await api.resolve("ChIJplace123", token, new AbortController().signal),
    ).toEqual(resolved);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://example.test/api/v1/customer/location/search",
      "https://example.test/api/v1/customer/location/resolve",
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.credentials).toBe("include");
      expect(init?.headers).toMatchObject({ "x-cks-csrf": "csrf-fixture" });
      expect(JSON.parse(String(init?.body)).sessionToken).toBe(token);
    }
  });
});
