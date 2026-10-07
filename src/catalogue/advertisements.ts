import { date, exact, record, uuid } from "../customer/contracts";
import { isSafeExternalUrl } from "../webview/external-link";

export type AdvertisementAction =
  | { type: "NONE" }
  | { type: "PRODUCT"; productId: string }
  | { type: "CATEGORY"; categoryId: string }
  | { type: "EXTERNAL_URL"; url: string };

export type Advertisement = {
  id: string;
  placement: "HOME_HERO";
  displayOrder: number;
  altText: string;
  imageUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  action: AdvertisementAction;
};

const invalid = (): never => {
  throw Error("Invalid advertisement response.");
};
function action(value: unknown): AdvertisementAction {
  if (!record(value)) return invalid();
  if (value.type === "NONE" && exact(value, ["type"])) return { type: "NONE" };
  if (
    value.type === "PRODUCT" &&
    exact(value, ["type", "productId"]) &&
    uuid(value.productId)
  )
    return { type: "PRODUCT", productId: value.productId };
  if (
    value.type === "CATEGORY" &&
    exact(value, ["type", "categoryId"]) &&
    uuid(value.categoryId)
  )
    return { type: "CATEGORY", categoryId: value.categoryId };
  if (
    value.type === "EXTERNAL_URL" &&
    exact(value, ["type", "url"]) &&
    isSafeExternalUrl(value.url)
  )
    return { type: "EXTERNAL_URL", url: value.url };
  return invalid();
}

export function parseAdvertisements(value: unknown): Advertisement[] {
  if (
    !record(value) ||
    !exact(value, ["data"]) ||
    !Array.isArray(value.data) ||
    value.data.length > 10
  )
    return invalid();
  const ads = value.data.map((v): Advertisement => {
    if (
      !record(v) ||
      !exact(v, [
        "id",
        "placement",
        "displayOrder",
        "altText",
        "imageUrl",
        "startsAt",
        "endsAt",
        "action",
      ]) ||
      !uuid(v.id) ||
      v.placement !== "HOME_HERO" ||
      typeof v.displayOrder !== "number" ||
      !Number.isSafeInteger(v.displayOrder) ||
      v.displayOrder < 1 ||
      v.displayOrder > 2147483647 ||
      typeof v.altText !== "string" ||
      v.altText.length > 500 ||
      typeof v.imageUrl !== "string" ||
      !/^\/api\/v1\/advertisement-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(
        v.imageUrl,
      ) ||
      v.imageUrl.split("/")[4].toLowerCase() !== v.id.toLowerCase() ||
      !uuid(v.imageUrl.split("/")[5]) ||
      !(v.startsAt === null || date(v.startsAt)) ||
      !(v.endsAt === null || date(v.endsAt))
    )
      return invalid();
    return {
      id: v.id,
      placement: "HOME_HERO",
      displayOrder: v.displayOrder,
      altText: v.altText,
      imageUrl: v.imageUrl,
      startsAt: v.startsAt as string | null,
      endsAt: v.endsAt as string | null,
      action: action(v.action),
    };
  });
  if (new Set(ads.map((ad) => ad.id)).size !== ads.length) return invalid();
  return ads;
}
