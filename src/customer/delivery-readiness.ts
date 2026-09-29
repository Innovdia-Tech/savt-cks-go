import type { Address } from "../addresses/contracts";

export const hasDeliveryCoordinates = (address: Address | undefined) =>
  Boolean(
    address &&
      address.status === "ACTIVE" &&
      typeof address.latitude === "number" &&
      Number.isFinite(address.latitude) &&
      typeof address.longitude === "number" &&
      Number.isFinite(address.longitude),
  );
