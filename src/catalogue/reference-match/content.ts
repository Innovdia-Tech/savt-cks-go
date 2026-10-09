import sample from "./reference-sample-content.json";
import type { Category, CustomerCategory, Detail } from "../contracts";

export type DevelopmentProduct = Detail & {
  category: Category;
  uom: NonNullable<Detail["uom"]>;
};

// The imported package is a local design fixture, never a catalogue seed.
export const referenceSample = sample;
export const referenceScenario = "ux03-reference-match";
export const referenceId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const referenceCategories: CustomerCategory[] =
  sample.categoryLabelsShownInBoard.map((name, index) => ({
    id: referenceId(10 + index),
    code: `REFERENCE_${index + 1}`,
    name,
  }));

const fruitKeys = new Set(["banana", "red-apple", "orange"]);
const vegetableKeys = new Set(["broccoli", "carrot", "tomato", "potato"]);

export const referenceProducts: DevelopmentProduct[] = sample.catalogue.map(
  (item, index) => ({
    productId: referenceId(100 + index),
    outletProductId: referenceId(200 + index),
    name: item.name,
    imageUrl: `https://cks-go-development.invalid/reference-match/${item.key}.png`,
    category: {
      id: referenceCategories[0].id,
      name: referenceCategories[0].name,
    },
    subcategory: fruitKeys.has(item.key)
      ? { id: referenceId(20), name: "Fruits" }
      : vegetableKeys.has(item.key)
        ? { id: referenceId(21), name: "Vegetables" }
        : null,
    brand: null,
    uom: { code: "SAMPLE_UNIT", name: item.displayUnit },
    packSize: item.displayUnit,
    sellingPriceMinor: item.sellingPriceMinor,
    currency: "MYR",
    availability: "AVAILABLE",
    description: null,
    storageType: "AMBIENT",
  }),
);

export const referenceProductByKey = (key: string) =>
  referenceProducts[sample.catalogue.findIndex((item) => item.key === key)];

export const referenceCategoryGrid = sample.categoryVisibleGrid.map(
  referenceProductByKey,
);
