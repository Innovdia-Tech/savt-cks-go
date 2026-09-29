export type DeliveryLocation = {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postcode?: string;
};

export type LocationFailureKind =
  "denied" | "unavailable" | "not-found" | "invalid" | "timeout";

export class DeliveryLocationError extends Error {
  constructor(readonly kind: LocationFailureKind) {
    super(kind);
    this.name = "DeliveryLocationError";
  }
}

export interface DeliveryLocationPort {
  requestCurrentLocation(): Promise<DeliveryLocation>;
  searchLocation(query: string): Promise<DeliveryLocation>;
}
