import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { syntheticAddress, syntheticProfile } from "../customer/fixtures";

const fixture = vi.hoisted(() => ({
  customer: {} as Record<string, unknown>,
  catalogue: {} as Record<string, unknown>,
}));
vi.mock("../customer/context", () => ({ useCustomer: () => fixture.customer }));
vi.mock("./context", () => ({ useCatalogue: () => fixture.catalogue }));
vi.mock("../checkout/context", () => ({
  useCheckout: () => ({
    state: { lines: [], paymentFrozen: false, transitionPhase: "idle" },
    controller: {},
  }),
}));
vi.mock("../payment/context", () => ({
  usePayment: () => ({ state: { phase: "idle" }, controller: {} }),
}));
vi.mock("../orders/context", () => ({
  useOrders: () => ({ state: {}, controller: {} }),
}));
import { CatalogueApp } from "./components";

afterEach(() => vi.unstubAllGlobals());

function renderStartup({
  embeddedHost = true,
  profilePhase = "loading",
  listPhase = "loading",
  selectedAddress,
}: {
  embeddedHost?: boolean;
  profilePhase?: "loading" | "ready" | "error";
  listPhase?: "loading" | "ready" | "error";
  selectedAddress?: typeof syntheticAddress;
} = {}) {
  vi.stubGlobal("window", { location: { hash: "#home", search: "" } });
  fixture.customer = {
    state: {
      profilePhase,
      listPhase,
      profile: profilePhase === "ready" ? syntheticProfile : null,
      addresses: selectedAddress ? [selectedAddress] : [],
      notice: "",
      noticeKind: "persistent",
    },
    controller: { selectedAddress: () => selectedAddress },
    currentLocation: {},
    guardNavigation: (action: () => void) => action(),
  };
  fixture.catalogue = {
    state: {
      phase: "address-loading",
      q: "",
      categories: [],
      homeCategories: [],
      featured: [],
      advertisements: [],
      assignment: null,
      products: null,
      detail: null,
    },
    controller: {},
    refreshing: false,
    refresh: () => Promise.resolve(false),
  };
  return renderToStaticMarkup(createElement(CatalogueApp, { embeddedHost }));
}

describe("authenticated embedded startup presentation", () => {
  it.each([
    ["loading", "loading"],
    ["ready", "loading"],
  ] as const)(
    "keeps the customer shell while profile=%s and addresses=%s are pending",
    (profilePhase, listPhase) => {
      const html = renderStartup({ profilePhase, listPhase });
      expect(html).toContain("app-shell__scroll");
      expect(html).toContain("Loading your address");
      expect(html).toContain('aria-label="Primary navigation"');
      expect(html).not.toContain("Getting CKS Go ready…");
      expect(html).not.toContain("cks-go-logo");
      expect(html).not.toContain("Set delivery location");
    },
  );

  it("keeps the established standalone branded startup", () => {
    const html = renderStartup({ embeddedHost: false });
    expect(html).toContain("Getting CKS Go ready…");
    expect(html).toContain("cks-go-logo");
  });

  it.each([undefined, syntheticAddress])(
    "shows delivery setup once successful reads establish a missing location",
    (selectedAddress) => {
      const html = renderStartup({
        profilePhase: "ready",
        listPhase: "ready",
        selectedAddress,
      });
      expect(html).toContain("Set delivery location");
      expect(html).not.toContain("Getting CKS Go ready…");
    },
  );

  it("preserves delivery loading error recovery", () => {
    const html = renderStartup({ profilePhase: "error", listPhase: "error" });
    expect(html).toContain("Your delivery details could not be loaded");
    expect(html).not.toContain("Getting CKS Go ready…");
  });
});
