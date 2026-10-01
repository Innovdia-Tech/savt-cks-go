import { expect, it } from "vitest";
import { homeCategories, homeCategoryArtwork } from "./shopping";
import { cartMerchandiseSummary } from "../checkout/state";

const categories = [
  { id: "other", code: "OTHER_CATEGORY", name: "Snacks" },
  { id: "drinks", code: "BEVERAGES", name: "Drinks" },
  { id: "frozen", code: "FROZEN", name: "Frozen Food" },
  { id: "fresh", code: "FRESH_PRODUCE", name: "Fresh Fruits & Vegetables" },
  { id: "house", code: "HOUSEHOLD", name: "Household Essentials" },
];

it("selects authoritative Phase 1 Home categories by code in preferred order", () => {
  expect(homeCategories(categories).map(({ id }) => id)).toEqual([
    "fresh",
    "house",
    "frozen",
    "drinks",
  ]);
  expect(
    homeCategories(categories.filter(({ id }) => id !== "frozen")).map(
      ({ id }) => id,
    ),
  ).toEqual(["fresh", "house", "drinks"]);
  expect(
    homeCategories([
      { id: "impostor", code: "OTHER_CATEGORY", name: "Frozen" },
    ]),
  ).toEqual([]);
});

it("maps stable codes to approved WebP artwork even after HQ renames categories", () => {
  expect(homeCategoryArtwork("FRESH_PRODUCE")).toContain("fresh-produce.webp");
  expect(homeCategoryArtwork("HOUSEHOLD")).toContain("household.webp");
  expect(homeCategoryArtwork("FROZEN")).toContain("frozen.webp");
  expect(homeCategoryArtwork("BEVERAGES")).toContain("beverages.webp");
  expect(homeCategoryArtwork("OTHER_CATEGORY")).toBeNull();
  expect(homeCategoryArtwork("Frozen Food")).toBeNull();
});

it("totals basket units and merchandise minor units from the current cart lines", () => {
  const lines = [
    { quantity: 2, displayedUnitPriceMinor: 450 },
    { quantity: 1, displayedUnitPriceMinor: 299 },
  ];
  expect(cartMerchandiseSummary(lines)).toEqual({
    count: 3,
    subtotalMinor: 1199,
  });
  expect(cartMerchandiseSummary([])).toEqual({ count: 0, subtotalMinor: 0 });
});
