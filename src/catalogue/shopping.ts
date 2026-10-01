import type { CustomerCategory } from "./contracts";
import freshProduce from "../assets/categories/fresh-produce.webp";
import household from "../assets/categories/household.webp";
import frozen from "../assets/categories/frozen.webp";
import beverages from "../assets/categories/beverages.webp";

const preferred = ["FRESH_PRODUCE", "HOUSEHOLD", "FROZEN", "BEVERAGES"];
const artwork: Record<string, string> = {
  FRESH_PRODUCE: freshProduce,
  HOUSEHOLD: household,
  FROZEN: frozen,
  BEVERAGES: beverages,
};

export function homeCategoryArtwork(code: string): string | null {
  return artwork[code] ?? null;
}

export function homeCategories(
  categories: CustomerCategory[],
): CustomerCategory[] {
  return preferred.flatMap((code) => {
    const category = categories.find((item) => item.code === code);
    return category ? [category] : [];
  });
}
