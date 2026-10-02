import { expect, it } from "vitest";
import { homeCategories, homeCategoryArtwork } from "./shopping";
import { cartMerchandiseSummary } from "../checkout/state";

const categories = [
  { id: "other", code: "OTHER_CATEGORY", name: "Snacks" },
  { id: "drinks", code: "004", name: "Beverages" },
  { id: "frozen", code: "003", name: "Frozen" },
  { id: "fresh", code: "001", name: "Fresh Produce" },
  { id: "house", code: "002", name: "Household" },
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
  const renamed = categories.map((category) =>
    category.code === "001"
      ? { ...category, name: "Seasonal picks" }
      : category,
  );
  expect(homeCategories(renamed)[0].name).toBe("Seasonal picks");
  expect(homeCategoryArtwork(homeCategories(renamed)[0].code)).toContain(
    "fresh-produce.webp",
  );
  expect(homeCategoryArtwork("002")).toContain("household.webp");
  expect(homeCategoryArtwork("003")).toContain("frozen.webp");
  expect(homeCategoryArtwork("004")).toContain("beverages.webp");
  expect(homeCategoryArtwork("OTHER_CATEGORY")).toBeNull();
  expect(homeCategoryArtwork("Frozen Food")).toBeNull();
});

it("does not use display names, old preferred codes or near-matching codes as Home fallbacks", () => {
  const unrelated = [
    { id: "old-fresh", code: "FRESH_PRODUCE", name: "Fresh Produce" },
    { id: "old-house", code: "HOUSEHOLD", name: "Household" },
    { id: "old-frozen", code: "FROZEN", name: "Frozen" },
    { id: "old-drinks", code: "BEVERAGES", name: "Beverages" },
    { id: "impostor", code: "PILOT-SNK", name: "Fresh Produce" },
    { id: "near", code: "1", name: "Fresh Produce" },
  ];
  expect(homeCategories(unrelated)).toEqual([]);
  for (const category of unrelated)
    expect(homeCategoryArtwork(category.code)).toBeNull();
  expect(homeCategories([...unrelated, ...categories])).toEqual(
    homeCategories(categories),
  );
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
