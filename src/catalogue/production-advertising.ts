import type { AdvertisingSlide } from "./AdvertisingCarousel";

export const productionAdvertisingSlides: readonly AdvertisingSlide[] = [
  {
    id: "cks-go-fresh-choices",
    eyebrow: "CKS Go",
    title: "Fresh choices, closer to home",
    description: "Browse groceries from the CKS outlet assigned to your delivery address.",
    theme: "berry",
    action: { label: "Shop categories", target: "categories" },
  },
  {
    id: "cks-go-everyday-essentials",
    eyebrow: "Everyday groceries",
    title: "Your essentials in one simple shop",
    description: "Search the current outlet catalogue and add available items to your basket.",
    theme: "sunrise",
    action: { label: "Browse groceries", target: "categories" },
  },
  {
    id: "cks-go-neighbourhood-store",
    eyebrow: "CKS Retail",
    title: "Shop from your assigned neighbourhood store",
    description: "Availability and prices come from the CKS Go catalogue for your selected delivery address.",
    theme: "forest",
    action: { label: "View categories", target: "categories" },
  },
];
