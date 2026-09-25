// Vite serves these source excerpts in development. No asset is imported into
// the production graph, so the supplied sample PNGs stay out of dist/.
const localArtwork = (name: string) =>
  `/src/catalogue/reference-match/sample-artwork/${name}.png`;

export const campaignArtworkUrl = localArtwork("campaign-produce-basket");
const productKeys = new Set([
  "banana",
  "red-apple",
  "orange",
  "broccoli",
  "carrot",
  "tomato",
  "potato",
]);
const categoryKeys = new Map([
  ["Fruits & Vegetables", "category-fruit-vegetables"],
  ["Meat & Seafood", "category-meat-seafood"],
  ["Dairy & Chilled", "category-dairy-chilled"],
  ["Pantry Essentials", "category-pantry"],
]);

export const productArtworkFor = (url: string) => {
  const key = url.match(
    /^https:\/\/cks-go-development\.invalid\/reference-match\/([a-z-]+)\.png$/,
  )?.[1];
  return key && productKeys.has(key) ? localArtwork(key) : null;
};
export const categoryArtworkFor = (name: string) => {
  const key = categoryKeys.get(name);
  return key ? localArtwork(key) : null;
};
