import type { Category } from "./contracts";
import freshProduce from "../assets/categories/fresh-produce.png";
import household from "../assets/categories/household.png";
import frozen from "../assets/categories/frozen.png";
import beverages from "../assets/categories/beverages.png";

const preferred = ["fresh produce", "household", "frozen", "beverages"];
const normalize = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");
const artwork: Record<string, string> = {
  "fresh produce": freshProduce,
  household,
  frozen,
  beverages,
};

export function homeCategoryArtwork(name: string): string | null {
  return artwork[normalize(name)] ?? null;
}

export function homeCategories(categories: Category[]): Category[] {
  return preferred.flatMap((name) => {
    const category = categories.find((item) => normalize(item.name) === name);
    return category ? [category] : [];
  });
}
