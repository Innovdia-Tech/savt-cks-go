import { expect, it } from "vitest";
import { homeCategories, homeCategoryArtwork } from "./shopping";
import { cartMerchandiseSummary } from "../checkout/state";

const categories = [
  { id: "other", name: "Pantry" },
  { id: "drinks", name: " Beverages " },
  { id: "frozen", name: "Frozen" },
  { id: "fresh", name: "Fresh   Produce" },
  { id: "house", name: "Household" },
];

it("selects only available Phase 1 Home categories in the preferred order", () => {
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
});

it("maps each preferred category to its supplied artwork", () => {
  expect(homeCategoryArtwork("Fresh Produce")).toContain("fresh-produce.webp");
  expect(homeCategoryArtwork("Household")).toContain("household.webp");
  expect(homeCategoryArtwork("Frozen")).toContain("frozen.webp");
  expect(homeCategoryArtwork("Beverages")).toContain("beverages.webp");
  expect(homeCategoryArtwork("Pantry")).toBeNull();
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
