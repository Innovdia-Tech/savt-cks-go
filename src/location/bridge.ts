import {
  DeliveryLocationError,
  type DeliveryLocation,
  type DeliveryLocationPort,
} from "./contracts";

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

const optionalText = (value: unknown, max: number): string | undefined => {
  if (value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > max)
    throw new DeliveryLocationError("invalid");
  return value;
};

function parseLocationResult(
  value: unknown,
  requestId: string,
): DeliveryLocation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DeliveryLocationError("invalid");
  const data = value as Record<string, unknown>;
  if (
    !exactKeys(data, [
      "protocolVersion",
      "requestId",
      "status",
      "latitude",
      "longitude",
      "formattedAddress",
      "addressLine1",
      "city",
      "state",
      "postcode",
    ]) ||
    data.protocolVersion !== "1" ||
    data.requestId !== requestId ||
    !uuidV4.test(String(data.requestId))
  )
    throw new DeliveryLocationError("invalid");

  if (data.status !== "ok") {
    if (
      [
        "latitude",
        "longitude",
        "formattedAddress",
        "addressLine1",
        "city",
        "state",
        "postcode",
      ].some((key) => data[key] !== null)
    )
      throw new DeliveryLocationError("invalid");
    if (data.status === "denied") throw new DeliveryLocationError("denied");
    if (data.status === "not-found")
      throw new DeliveryLocationError("not-found");
    if (data.status === "unavailable")
      throw new DeliveryLocationError("unavailable");
    throw new DeliveryLocationError("invalid");
  }

  if (
    typeof data.latitude !== "number" ||
    !Number.isFinite(data.latitude) ||
    Math.abs(data.latitude) > 90 ||
    typeof data.longitude !== "number" ||
    !Number.isFinite(data.longitude) ||
    Math.abs(data.longitude) > 180
  )
    throw new DeliveryLocationError("invalid");

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    formattedAddress: optionalText(data.formattedAddress, 400),
    addressLine1: optionalText(data.addressLine1, 200),
    city: optionalText(data.city, 100),
    state: optionalText(data.state, 100),
    postcode: optionalText(data.postcode, 20),
  };
}

type Pending = {
  resolve: (value: DeliveryLocation) => void;
  reject: (error: DeliveryLocationError) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class BrowserDeliveryLocationPort implements DeliveryLocationPort {
  private readonly pending = new Map<string, Pending>();
  private listening = false;

  constructor(private readonly timeoutMs = 20_000) {}

  requestCurrentLocation(): Promise<DeliveryLocation> {
    if (window.SavtCksGoBridge)
      return this.requestNative({ type: "location-current" });
    return this.requestBrowserCurrentLocation();
  }

  searchLocation(query: string): Promise<DeliveryLocation> {
    const value = query.trim();
    if (!value || value.length > 300)
      return Promise.reject(new DeliveryLocationError("invalid"));
    if (!window.SavtCksGoBridge)
      return Promise.reject(new DeliveryLocationError("unavailable"));
    return this.requestNative({ type: "location-search", query: value });
  }

  private requestNative(
    message:
      { type: "location-current" } | { type: "location-search"; query: string },
  ): Promise<DeliveryLocation> {
    const requestId = crypto.randomUUID();
    this.ensureListener();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new DeliveryLocationError("timeout"));
      }, this.timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      try {
        window.SavtCksGoBridge!.postMessage(
          JSON.stringify({ ...message, requestId, protocolVersion: "1" }),
        );
      } catch {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(new DeliveryLocationError("unavailable"));
      }
    });
  }

  private readonly handleLocationEvent = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail : undefined;
    const requestId =
      detail && typeof detail === "object" && !Array.isArray(detail)
        ? (detail as Record<string, unknown>).requestId
        : undefined;
    if (typeof requestId !== "string") return;
    const pending = this.pending.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(requestId);
    try {
      pending.resolve(parseLocationResult(detail, requestId));
    } catch (error) {
      pending.reject(
        error instanceof DeliveryLocationError
          ? error
          : new DeliveryLocationError("invalid"),
      );
    }
  };

  private ensureListener() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("savt-cks-go-location", this.handleLocationEvent);
  }

  dispose() {
    if (this.listening) {
      window.removeEventListener(
        "savt-cks-go-location",
        this.handleLocationEvent,
      );
      this.listening = false;
    }
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new DeliveryLocationError("unavailable"));
    }
    this.pending.clear();
  }

  private requestBrowserCurrentLocation(): Promise<DeliveryLocation> {
    if (!navigator.geolocation)
      return Promise.reject(new DeliveryLocationError("unavailable"));
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        (error) =>
          reject(
            new DeliveryLocationError(
              error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
            ),
          ),
        {
          enableHighAccuracy: true,
          timeout: this.timeoutMs,
          maximumAge: 30_000,
        },
      );
    });
  }
}
