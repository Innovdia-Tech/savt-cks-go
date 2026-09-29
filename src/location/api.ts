import type { CustomerSessionController } from "../session/controller";
import { DeliveryLocationError, type DeliveryLocation } from "./contracts";

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  distanceMeters: number | null;
};
export type ResolvedPlace = DeliveryLocation & {
  placeId: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postcode: string;
  countryCode: "MY";
};
const idPattern = /^[A-Za-z0-9_-]{1,255}$/;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = (): never => {
  throw new DeliveryLocationError("invalid");
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
const keys = (value: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(value).length === names.length &&
  names.every((name) => Object.hasOwn(value, name));
const string = (value: unknown, max: number, empty = false): string => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    return invalid();
  return value;
};
const coordinate = (value: unknown, limit: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= limit
    ? value
    : invalid();

export function parseSuggestions(value: unknown): PlaceSuggestion[] {
  const outer = object(value);
  if (!keys(outer, ["data"])) return invalid();
  const data = object(outer.data);
  if (
    !keys(data, ["suggestions"]) ||
    !Array.isArray(data.suggestions) ||
    data.suggestions.length > 5
  )
    return invalid();
  return data.suggestions.map((item: unknown) => {
    const row = object(item);
    if (
      !keys(row, ["placeId", "primaryText", "secondaryText", "distanceMeters"])
    )
      return invalid();
    const placeId = string(row.placeId, 255);
    if (!idPattern.test(placeId)) return invalid();
    const distance = row.distanceMeters;
    if (
      distance !== null &&
      (typeof distance !== "number" ||
        !Number.isSafeInteger(distance) ||
        distance < 0)
    )
      return invalid();
    return {
      placeId,
      primaryText: string(row.primaryText, 200),
      secondaryText: string(row.secondaryText, 300, true),
      distanceMeters: distance as number | null,
    };
  });
}

export function parseResolvedPlace(value: unknown): ResolvedPlace {
  const outer = object(value);
  if (!keys(outer, ["data"])) return invalid();
  const row = object(outer.data);
  if (
    !keys(row, [
      "placeId",
      "formattedAddress",
      "addressLine1",
      "city",
      "state",
      "postcode",
      "countryCode",
      "latitude",
      "longitude",
    ])
  )
    return invalid();
  const placeId = string(row.placeId, 255);
  if (!idPattern.test(placeId) || row.countryCode !== "MY") return invalid();
  return {
    placeId,
    formattedAddress: string(row.formattedAddress, 400),
    addressLine1: string(row.addressLine1, 200),
    city: string(row.city, 100, true),
    state: string(row.state, 100, true),
    postcode: string(row.postcode, 20, true),
    countryCode: "MY",
    latitude: coordinate(row.latitude, 90),
    longitude: coordinate(row.longitude, 180),
  };
}

export interface LocationSearchPort {
  search(
    input: string,
    sessionToken: string,
    signal: AbortSignal,
    bias?: { latitude: number; longitude: number },
  ): Promise<PlaceSuggestion[]>;
  resolve(
    placeId: string,
    sessionToken: string,
    signal: AbortSignal,
  ): Promise<ResolvedPlace>;
}

export class LocationSearchApi implements LocationSearchPort {
  constructor(
    private readonly origin: string,
    private readonly session: CustomerSessionController,
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
  ) {}

  search(
    input: string,
    sessionToken: string,
    signal: AbortSignal,
    bias?: { latitude: number; longitude: number },
  ) {
    return this.request(
      "search",
      { input, sessionToken, ...(bias ? { bias } : {}) },
      signal,
      parseSuggestions,
    );
  }

  resolve(placeId: string, sessionToken: string, signal: AbortSignal) {
    return this.request(
      "resolve",
      { placeId, sessionToken },
      signal,
      parseResolvedPlace,
    );
  }

  private async request<T>(
    route: "search" | "resolve",
    body: Record<string, unknown>,
    signal: AbortSignal,
    parse: (value: unknown) => T,
  ): Promise<T> {
    if (!uuid.test(String(body.sessionToken)) || signal.aborted)
      throw new DeliveryLocationError("invalid");
    return this.session.withCredentials(async (csrf) => {
      const deadline = new AbortController();
      const abort = () => deadline.abort();
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, 8_000);
      try {
        const response = await this.fetcher(
          `${this.origin}/api/v1/customer/location/${route}`,
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "x-cks-csrf": csrf,
            },
            body: JSON.stringify(body),
            signal: deadline.signal,
          },
        );
        if (!response.ok) throw new DeliveryLocationError("unavailable");
        return parse(await response.json());
      } catch (error) {
        if (error instanceof DeliveryLocationError) throw error;
        throw new DeliveryLocationError(
          deadline.signal.aborted ? "timeout" : "unavailable",
        );
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
      }
    });
  }
}
