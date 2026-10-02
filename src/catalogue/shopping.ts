import type { CustomerCategory } from "./contracts";
import freshProduce from "../assets/categories/fresh-produce.webp";
import household from "../assets/categories/household.webp";
import frozen from "../assets/categories/frozen.webp";
import beverages from "../assets/categories/beverages.webp";

const preferred = ["001", "002", "003", "004"];
const artwork: Record<string, string> = {
  "001": freshProduce,
  "002": household,
  "003": frozen,
  "004": beverages,
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
