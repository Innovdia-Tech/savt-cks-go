import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DevelopmentCustomerApi } from "../api/development";
import { syntheticAddress } from "../customer/fixtures";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { AdvertisingCarousel } from "./AdvertisingCarousel";
import type { AdvertisementAction } from "./advertisements";
import { CatalogueApi } from "./api";
import { CatalogueController, type Binding } from "./state";

const now = Date.parse("2026-09-19T00:00:00.000Z");
const address = { ...syntheticAddress, latitude: 5, longitude: 116 };
const outletId = "11111111-1111-4111-8111-111111111111";
const adId = "33333333-3333-4333-8333-333333333333";
const assetId = "44444444-4444-4444-8444-444444444444";
const assignment = {
  assignmentContextId: "A".repeat(43),
  customerAddressId: address.id,
  addressRowVersion: address.rowVersion,
  outlet: {
    id: outletId,
    displayReference: "LOCAL",
    displayName: "Assigned delivery store",
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  },
  resolvedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 300000).toISOString(),
};
const advertisement = {
  id: adId,
  placement: "HOME_HERO",
  displayOrder: 1,
  altText: "HQ weekend grocery promotion",
  imageUrl: `/api/v1/advertisement-media/${adId}/${assetId}`,
  startsAt: null,
  endsAt: null,
  action: { type: "NONE" },
};
const page = (pageSize: number) => ({
  data: [],
  meta: {
    page: 1,
    pageSize,
    total: 0,
    hasNextPage: false,
    asOf: new Date(now).toISOString(),
    outlet: assignment.outlet,
    assignmentContextExpiresAt: assignment.expiresAt,
  },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function setup(
  replies: Partial<
    Record<
      "assignment" | "categories" | "products" | "advertisements",
      () => Response | Promise<Response>
    >
  > = {},
) {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  const requests: { url: string; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "/api/v1/customer/outlet-assignment")
      return (
        replies.assignment?.() ??
        Response.json({
          data: assignment,
          meta: { asOf: assignment.resolvedAt },
        })
      );
    if (
      url ===
      `/api/v1/customer/outlets/${outletId}/categories?page=1&pageSize=50`
    )
      return replies.categories?.() ?? Response.json(page(50));
    if (url.startsWith(`/api/v1/customer/outlets/${outletId}/products?`))
      return replies.products?.() ?? Response.json(page(24));
    if (url === "/api/v1/customer/advertisements?placement=HOME_HERO")
      return (
        replies.advertisements?.() ?? Response.json({ data: [advertisement] })
      );
    throw new Error(`Unexpected local request: ${url}`);
  };
  const controller = new CatalogueController(
    new CatalogueApi("", session, fetcher),
    () => now,
  );
  const binding: Binding = {
    session: session.getSnapshot(),
    address,
    phase: "ready",
    readOnly: false,
  };
  return { controller, requests, binding };
}

function renderAdvertisements(controller: CatalogueController) {
  return renderToStaticMarkup(
    createElement(AdvertisingCarousel, {
      slides: controller.getSnapshot().advertisements.map((ad) => ({
        id: ad.id,
        imageUrl: ad.imageUrl,
        altText: ad.altText,
        bannerAction: ad.action,
      })),
      onNavigate: () => {},
      onAction: () => {},
    }),
  );
}

describe("Home advertisement HTTP and rendering regression", () => {
  it("requests HOME_HERO once only after valid assignment and catalogue readiness", async () => {
    const assignmentReply = deferred<Response>();
    const categoriesReply = deferred<Response>();
    const productsReply = deferred<Response>();
    const { controller, requests, binding } = await setup({
      assignment: () => assignmentReply.promise,
      categories: () => categoriesReply.promise,
      products: () => productsReply.promise,
    });
    try {
      const loading = controller.bind(binding);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      expect(controller.getSnapshot().phase).toBe("assignment-loading");
      expect(renderAdvertisements(controller)).toBe("");
      assignmentReply.resolve(
        Response.json({
          data: assignment,
          meta: { asOf: assignment.resolvedAt },
        }),
      );
      await vi.waitFor(() => expect(requests).toHaveLength(3));
      expect(controller.getSnapshot().phase).toBe("loading");
      expect(requests.some(({ url }) => url.includes("/advertisements"))).toBe(
        false,
      );
      categoriesReply.resolve(Response.json(page(50)));
      productsReply.resolve(Response.json(page(24)));
      await loading;
      await vi.waitFor(() =>
        expect(controller.getSnapshot().advertisements).toHaveLength(1),
      );

      expect(controller.getSnapshot().phase).toBe("ready");
      const adRequests = requests.filter(({ url }) =>
        url.includes("/advertisements"),
      );
      expect(adRequests).toHaveLength(1);
      expect(adRequests[0].url).toBe(
        "/api/v1/customer/advertisements?placement=HOME_HERO",
      );
      expect(adRequests[0].init).toMatchObject({
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      expect(adRequests[0].init.body).toBeUndefined();
      expect([...new Headers(adRequests[0].init.headers).entries()]).toEqual([
        ["accept", "application/json"],
      ]);
      expect(adRequests[0].init.signal).toBeInstanceOf(AbortSignal);
      expect(renderAdvertisements(controller)).toContain(
        `src="/api/v1/advertisement-media/${adId}/${assetId}"`,
      );
      expect(renderAdvertisements(controller)).toContain(
        'alt="HQ weekend grocery promotion"',
      );
    } finally {
      controller.dispose();
    }
  });

  it.each([
    ["no authenticated customer", { session: null }],
    ["address still loading", { phase: "loading" }],
    ["no active address", { address: undefined }],
    ["address without coordinates", { address: syntheticAddress }],
  ] as const)("does not fetch advertisements with %s", async (_name, patch) => {
    const { controller, requests, binding } = await setup();
    try {
      await controller.bind({ ...binding, ...patch });
      expect(requests).toEqual([]);
      expect(renderAdvertisements(controller)).toBe("");
    } finally {
      controller.dispose();
    }
  });

  it("does not load advertisements when assignment belongs to another address", async () => {
    const { controller, requests, binding } = await setup({
      assignment: () =>
        Response.json({
          data: { ...assignment, customerAddressId: adId },
          meta: { asOf: assignment.resolvedAt },
        }),
    });
    try {
      await controller.bind(binding);
      expect(controller.getSnapshot()).toMatchObject({
        phase: "error",
        error: "INVALID_RESPONSE",
        advertisements: [],
      });
      expect(requests.map(({ url }) => url)).toEqual([
        "/api/v1/customer/outlet-assignment",
      ]);
      expect(renderAdvertisements(controller)).toBe("");
    } finally {
      controller.dispose();
    }
  });

  it.each([
    [{ type: "NONE" }, null],
    [{ type: "PRODUCT", productId: outletId }, "View product"],
    [{ type: "CATEGORY", categoryId: outletId }, "Browse category"],
    [
      { type: "EXTERNAL_URL", url: "https://cks.example/promotion" },
      "Open external website",
    ],
  ] satisfies [AdvertisementAction, string | null][])(
    "preserves the backend $0.type action and its artwork semantics",
    async (action, label) => {
      const { controller, binding } = await setup({
        advertisements: () =>
          Response.json({ data: [{ ...advertisement, action }] }),
      });
      try {
        await controller.bind(binding);
        await vi.waitFor(() =>
          expect(controller.getSnapshot().advertisements).toHaveLength(1),
        );
        expect(controller.getSnapshot().advertisements[0].action).toEqual(
          action,
        );
        const html = renderAdvertisements(controller);
        expect(html).toContain('alt="HQ weekend grocery promotion"');
        expect(html).not.toContain("advertising-carousel__content");
        if (label)
          expect(html).toContain(
            `aria-label="${label}: HQ weekend grocery promotion"`,
          );
        else expect(html).not.toContain("<button");
      } finally {
        controller.dispose();
      }
    },
  );

  it("removes an existing HQ carousel when a fresh response has zero advertisements", async () => {
    let feed: unknown = { data: [advertisement] };
    const { controller, requests, binding } = await setup({
      advertisements: () => Response.json(feed),
    });
    try {
      await controller.bind(binding);
      await vi.waitFor(() =>
        expect(controller.getSnapshot().advertisements).toHaveLength(1),
      );
      expect(renderAdvertisements(controller)).toContain(
        'aria-roledescription="carousel"',
      );
      feed = { data: [] };
      await controller.retry();
      await vi.waitFor(() =>
        expect(controller.getSnapshot().advertisements).toEqual([]),
      );
      expect(controller.getSnapshot().phase).toBe("ready");
      expect(
        requests.filter(({ url }) => url.includes("/advertisements")),
      ).toHaveLength(2);
      expect(renderAdvertisements(controller)).toBe("");
    } finally {
      controller.dispose();
    }
  });

  it("fails closed on private advertisement fields without a fallback banner", async () => {
    let feed: unknown = { data: [advertisement] };
    const { controller, binding } = await setup({
      advertisements: () => Response.json(feed),
    });
    try {
      await controller.bind(binding);
      await vi.waitFor(() =>
        expect(controller.getSnapshot().advertisements).toHaveLength(1),
      );
      feed = {
        data: [{ ...advertisement, internalName: "HQ private field" }],
      };
      await controller.retry();
      await vi.waitFor(() =>
        expect(controller.getSnapshot().advertisements).toEqual([]),
      );
      expect(controller.getSnapshot().phase).toBe("ready");
      expect(controller.getSnapshot().advertisements).toEqual([]);
      expect(renderAdvertisements(controller)).toBe("");
    } finally {
      controller.dispose();
    }
  });
});
