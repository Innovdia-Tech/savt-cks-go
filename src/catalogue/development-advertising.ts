import type { AdvertisingSlide } from "./AdvertisingCarousel";

export type DevelopmentAdvertisingScenario =
  "multiple" | "single" | "zero" | "failed-creative";

const primary: AdvertisingSlide = {
  id: "weekly-shop",
  eyebrow: "Development preview",
  title: "Everyday groceries, easy to find",
  description: "Browse the customer catalogue by category.",
  theme: "berry",
  action: { label: "Shop categories", target: "categories" },
};

const secondary: AdvertisingSlide = {
  id: "cupboard",
  eyebrow: "Development preview",
  title: "Restock the cupboard from one place",
  description: "Search the current outlet catalogue.",
  theme: "forest",
};

const tertiary: AdvertisingSlide = {
  id: "fresh-list",
  eyebrow: "Development preview",
  title: "Build your next grocery list",
  description: "Review availability before adding an item.",
  theme: "sunrise",
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
