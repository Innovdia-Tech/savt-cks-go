import type { AdvertisingSlide } from "./AdvertisingCarousel";
import { groceryBannerArtworkUrl } from "./development-artwork";

export type DevelopmentAdvertisingScenario =
  "multiple" | "single" | "zero" | "failed-creative";

const primary: AdvertisingSlide = {
  id: "weekly-shop",
  eyebrow: "Development preview",
  title: "Everyday groceries, easy to find",
  description: "Browse the customer catalogue by category.",
  theme: "berry",
  imageUrl: groceryBannerArtworkUrl,
  action: { label: "Shop categories", target: "categories" },
};

const secondary: AdvertisingSlide = {
  id: "cupboard",
  eyebrow: "Development preview",
  title: "Restock the cupboard from one place",
  description: "Search the current outlet catalogue.",
  theme: "forest",
  imageUrl: groceryBannerArtworkUrl,
};

const tertiary: AdvertisingSlide = {
  id: "fresh-list",
  eyebrow: "Development preview",
  title: "Build your next grocery list",
  description: "Review availability before adding an item.",
  theme: "sunrise",
  imageUrl: groceryBannerArtworkUrl,
};

export function developmentAdvertisingSlides(
  scenario: DevelopmentAdvertisingScenario,
): AdvertisingSlide[] {
  if (scenario === "zero") return [];
  if (scenario === "single") return [primary];
  if (scenario === "failed-creative")
    return [
      {
        ...secondary,
        id: "missing-creative",
        imageUrl: "/__development_missing_advertising_creative__.webp",
      },
      primary,
    ];
  return [primary, secondary, tertiary];
}
