import { DeliveryLocationError, type CurrentLocationPort } from "./contracts";
import type {
  LocationSearchPort,
  PlaceSuggestion,
  ResolvedPlace,
  ReverseAddress,
} from "./api";

const places: PlaceSuggestion[] = [
  {
    placeId: "ChIJsyntheticItccMall",
    primaryText: "ITCC Shopping Mall",
    secondaryText: "Penampang, Sabah, Malaysia",
    distanceMeters: null,
  },
  {
    placeId: "ChIJsyntheticItcc",
    primaryText: "ITCC Penampang",
    secondaryText: "89500 Penampang, Sabah",
    distanceMeters: null,
  },
  {
    placeId: "ChIJsyntheticItccCentre",
    primaryText: "International Technology & Commercial Centre",
    secondaryText: "Penampang, Sabah",
    distanceMeters: null,
  },
];

export class DevelopmentLocationSearch implements LocationSearchPort {
  reverse(
    pin: { latitude: number; longitude: number },
    _signal: AbortSignal,
  ): Promise<ReverseAddress> {
    const testPins = (globalThis as { __cksGoUx02Pins?: Array<typeof pin> })
      .__cksGoUx02Pins;
    testPins?.push({ ...pin });
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("reverse-partial")
    )
      return Promise.resolve({
        formattedAddress: "Malaysia",
        addressLine1: "",
        city: "",
        state: "",
        postcode: "",
        countryCode: "MY",
        ...pin,
      });
    return Promise.resolve({
      formattedAddress:
        "Jalan Pintas Penampang, 89500 Penampang, Sabah, Malaysia",
      addressLine1: "Jalan Pintas Penampang",
      city: "Penampang",
      state: "Sabah",
      postcode: "89500",
      countryCode: "MY",
      ...pin,
    });
  }
  search(
    input: string,
    _token: string,
    _signal: AbortSignal,
  ): Promise<PlaceSuggestion[]> {
    const query = input.toLowerCase();
    if (query.includes("unavailable"))
      return Promise.reject(new DeliveryLocationError("unavailable"));
    if (query.includes("nowhere") || query.includes("no results"))
      return Promise.resolve([]);
    return Promise.resolve(
      places.filter(
        (place) =>
          query.includes("itcc") ||
          place.primaryText.toLowerCase().includes(query),
      ),
    );
  }
  resolve(
    placeId: string,
    _token: string,
    _signal: AbortSignal,
  ): Promise<ResolvedPlace> {
    const place = places.find((candidate) => candidate.placeId === placeId);
    if (!place) return Promise.reject(new DeliveryLocationError("not-found"));
    return Promise.resolve({
      placeId,
      formattedAddress: `${place.primaryText}, Jalan Pintas Penampang, 89500 Penampang, Sabah, Malaysia`,
      addressLine1: "Jalan Pintas Penampang",
      city: "Penampang",
      state: "Sabah",
      postcode: "89500",
      countryCode: "MY",
      latitude: 5.9186,
      longitude: 116.0818,
    });
  }
}

export type DevelopmentGpsMode = "available" | "denied" | "unavailable";

export class DevelopmentCurrentLocation implements CurrentLocationPort {
  private mode: DevelopmentGpsMode = "available";

  setMode(mode: DevelopmentGpsMode) {
    this.mode = mode;
  }

  requestCurrentLocation() {
    if (this.mode !== "available")
      return Promise.reject(
        new DeliveryLocationError(
          this.mode === "denied" ? "denied" : "unavailable",
        ),
      );
    return Promise.resolve({
      latitude: 5.9186,
      longitude: 116.0818,
      formattedAddress:
        "Jalan Pintas Penampang, 89500 Penampang, Sabah, Malaysia",
      addressLine1: "Jalan Pintas Penampang",
      city: "Penampang",
      state: "Sabah",
      postcode: "89500",
    });
  }
}
