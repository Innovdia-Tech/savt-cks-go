import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogueApp } from "./components";

// Isolate presentation from session/network effects. Directory authority and
// request fencing remain covered by the real controller tests.
const fixture = vi.hoisted(() => ({
  catalogue: {
    phase: "ready",
    q: "",
    categories: [{ id: "frozen", code: "003", name: "Frozen Food" }],
    homeCategories: [
      { id: "drinks", code: "004", name: "Beverages" },
      {
        id: "unrelated",
        code: "SYNTHETIC_OTHER",
        name: "Other active category",
      },
      { id: "frozen", code: "003", name: "Frozen Food" },
      { id: "household", code: "002", name: "Household" },
      { id: "fresh", code: "001", name: "Fresh Produce" },
    ],
    categoryId: undefined as string | undefined,
    categoryPage: 1,
    categoryHasNext: true,
    products: { data: [], meta: { total: 0 } },
    assignment: null,
    readOnly: false,
  },
  customer: { listPhase: "ready", notice: null },
  address: {
    status: "ACTIVE",
    label: "Home",
    addressLine1: "Jalan Pintas",
    city: "Penampang",
    latitude: 5.9,
    longitude: 116.1,
  },
}));
vi.mock("./context", () => ({
  useCatalogue: () => ({ state: fixture.catalogue, controller: {} }),
}));
vi.mock("../checkout/context", () => ({
  useCheckout: () => ({
    state: { lines: [], assignment: null },
    controller: {},
  }),
}));
vi.mock("../payment/context", () => ({
  usePayment: () => ({ state: { phase: "idle" }, controller: {} }),
}));
vi.mock("../orders/context", () => ({
  useOrders: () => ({ state: {}, controller: {} }),
}));
vi.mock("../customer/context", () => ({
  useCustomer: () => ({
    state: fixture.customer,
    controller: { selectedAddress: () => fixture.address },
    guardNavigation: () => {},
  }),
}));

beforeEach(() => {
  fixture.catalogue.categoryId = undefined;
  vi.stubGlobal("window", {
    location: { hash: "#home", search: "" },
    matchMedia: () => ({ matches: true }),
  });
});
afterEach(() => vi.unstubAllGlobals());
const render = () =>
  renderToStaticMarkup(createElement(CatalogueApp, { embeddedHost: true }));

it("describes featured products without claiming personalization or duplicating native chrome", () => {
  const html = render();
  expect(html).toContain("Featured products");
  expect(html).toContain('placeholder="Search products"');
  expect(html).not.toContain("Featured for You");
  expect(html).not.toContain('aria-label="Back"');
  expect(html).not.toContain('aria-label="Close CKS Go"');
});

it("shows accumulated later-page categories in Browse without manual directory pagination", () => {
  window.location.hash = "#categories";
  const html = render();
  expect(html).toContain("Household");
  for (const category of fixture.catalogue.homeCategories)
    expect(html).toContain(category.name);
  expect(html).toContain("All products");
  expect(html).not.toContain("Previous categories");
  expect(html).not.toContain("More categories");
});

it("renders exactly four Home shortcuts in fixed code order with backend labels and approved artwork", () => {
  const html = render();
  const shortcuts =
    html.split('class="catalogue-category-tiles"')[1]?.split("</section>")[0] ??
    "";
  expect(html).toContain('id="home-categories-title">Categories');
  expect(html).toContain("See all");
  const expected = [
    ["Fresh Produce", "fresh-produce.webp"],
    ["Household", "household.webp"],
    ["Frozen Food", "frozen.webp"],
    ["Beverages", "beverages.webp"],
  ];
  expect(shortcuts.match(/<button/g)).toHaveLength(4);
  let position = -1;
  for (const [name, file] of expected) {
    const artworkPosition = shortcuts.indexOf(file);
    expect(artworkPosition).toBeGreaterThan(position);
    position = shortcuts.indexOf(`<span>${name}</span>`, artworkPosition);
    expect(position).toBeGreaterThan(artworkPosition);
  }
  expect(shortcuts).not.toContain("Other active category");
});

it("keeps code-selected Fresh artwork and exposes the renamed backend label", () => {
  const fresh = fixture.catalogue.homeCategories.find(
    (category) => category.code === "001",
  )!;
  const originalName = fresh.name;
  fresh.name = "Seasonal picks";
  try {
    const html = render();
    expect(html).toContain("fresh-produce.webp");
    expect(html).toContain("<span>Seasonal picks</span>");
    expect(html).not.toContain("Fresh Produce");
  } finally {
    fresh.name = originalName;
  }
});

it("uses the selected category as screen and search context and offers a normal empty recovery", () => {
  window.location.hash = "#categories";
  fixture.catalogue.categoryId = "frozen";
  const html = render();
  expect(html).toContain('placeholder="Search Frozen Food"');
  expect(html).not.toContain("Browse &gt;");
  expect(html).toContain("No products here yet");
  expect(html).toContain("Try another category or view all products.");
  expect(html).toContain("View all products");
});

it("leaves product and order Back chrome to the embedded native host", () => {
  for (const [route, label] of [
    ["detail/00000000-0000-4000-8000-000000000100", "Back to products"],
    ["order/00000000-0000-4000-8000-000000000101", "Back to orders"],
  ]) {
    window.location.hash = `#${route}`;
    expect(render()).not.toContain(`class="catalogue-link">${label}</button>`);
  }
});
