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
    categories: [{ id: "frozen", code: "FROZEN", name: "Frozen Food" }],
    homeCategories: [
      { id: "frozen", code: "FROZEN", name: "Frozen Food" },
      { id: "household", code: "HOUSEHOLD", name: "Household" },
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
  expect(html).toContain("All products");
  expect(html).not.toContain("Previous categories");
  expect(html).not.toContain("More categories");
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
