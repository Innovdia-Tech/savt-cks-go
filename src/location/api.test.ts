import { describe, expect, it, vi } from "vitest";
import {
  parseResolvedPlace,
  parseReverseAddress,
  parseSuggestions,
  LocationSearchApi,
} from "./api";
import { ApiClientError, type CustomerApi } from "../api/client";
import { CustomerSessionController } from "../session/controller";
import type { NativeBridgePort } from "../webview/bridge";
import { DeliveryLocationError } from "./contracts";

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
const reversed = (({ placeId: _placeId, ...rest }) => rest)(resolved);
const session = {
  withCredentials: <T>(operation: (csrf: string) => Promise<T>) =>
    operation("csrf-fixture"),
} as CustomerSessionController;

const authenticatedSession = async () => {
  const unexpectedAuthentication = async (): Promise<never> => {
    throw new Error("Location failures must not restart authentication.");
  };
  const api: CustomerApi = {
    status: async () => ({
      authenticated: true,
      expiresAt: "2026-10-12T12:30:00.000Z",
      csrfToken: "D".repeat(43),
    }),
    bootstrap: unexpectedAuthentication,
    exchange: unexpectedAuthentication,
    requestWebOtp: unexpectedAuthentication,
    authorizeWebOtp: unexpectedAuthentication,
    logout: unexpectedAuthentication,
  };
  const bridge: NativeBridgePort = {
    requestLaunchCode: unexpectedAuthentication,
    requestPaymentHandoff: unexpectedAuthentication,
    notifyLoaded: () => undefined,
    notifyError: vi.fn(),
  };
  const controller = new CustomerSessionController(api, bridge);
  await controller.start();
  return { controller, bridge };
};

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

  it("accepts partial reverse text but rejects changed coordinates and hidden fields", () => {
    expect(
      parseReverseAddress({
        data: { ...reversed, addressLine1: "", postcode: "" },
      }),
    ).toEqual({ ...reversed, addressLine1: "", postcode: "" });
    expect(() =>
      parseReverseAddress({ data: { ...reversed, countryCode: "SG" } }),
    ).toThrow();
    expect(() =>
      parseReverseAddress({ data: { ...reversed, rawGoogle: true } }),
    ).toThrow();
    expect(() =>
      parseReverseAddress({ data: { ...reversed, latitude: 91 } }),
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

  it("sends a reverse request only when explicitly called, with pin coordinates and no session token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: reversed }));
    const api = new LocationSearchApi("https://example.test", session, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      await api.reverse(
        { latitude: 5.92, longitude: 116.08 },
        new AbortController().signal,
      ),
    ).toEqual(reversed);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://example.test/api/v1/customer/location/reverse");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect(init?.headers).toMatchObject({ "x-cks-csrf": "csrf-fixture" });
    expect(JSON.parse(String(init?.body))).toEqual({
      latitude: 5.92,
      longitude: 116.08,
    });
  });

  it.each([
    ["search", "json"],
    ["search", "malformed"],
    ["resolve", "json"],
    ["resolve", "malformed"],
  ] as const)(
    "expires the existing session for a confirmed %s 401 with a %s body",
    async (route, body) => {
      const { controller, bridge } = await authenticatedSession();
      const response =
        body === "json"
          ? Response.json(
              {
                error: {
                  code: "CUSTOMER_SESSION_INVALID",
                  message: "Session expired.",
                },
              },
              { status: 401 },
            )
          : new Response("invalid", { status: 401 });
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      const api = new LocationSearchApi(
        "https://example.test",
        controller,
        fetcher,
      );
      const request = () =>
        route === "search"
          ? api.search("ITCC", token, new AbortController().signal)
          : api.resolve("ChIJplace123", token, new AbortController().signal);
      const failure = request();

      await expect(failure).rejects.toBeInstanceOf(ApiClientError);
      await expect(failure).rejects.toMatchObject({
        category: "expired",
        code: "CUSTOMER_SESSION_INVALID",
      });
      expect(controller.getSnapshot()).toEqual({ phase: "expired" });
      expect(bridge.notifyError).toHaveBeenCalledExactlyOnceWith(
        "CUSTOMER_SESSION_INVALID",
      );
      await expect(request()).rejects.toMatchObject({ category: "expired" });
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it.each(["search", "resolve"] as const)(
    "keeps the session authenticated and does not retry a %s 503",
    async (route) => {
      const { controller, bridge } = await authenticatedSession();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("unavailable", { status: 503 }));
      const api = new LocationSearchApi(
        "https://example.test",
        controller,
        fetcher,
      );
      const failure =
        route === "search"
          ? api.search("ITCC", token, new AbortController().signal)
          : api.resolve("ChIJplace123", token, new AbortController().signal);

      await expect(failure).rejects.toBeInstanceOf(DeliveryLocationError);
      await expect(failure).rejects.toMatchObject({ kind: "unavailable" });
      expect(controller.getSnapshot().phase).toBe("authenticated");
      expect(bridge.notifyError).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
});
