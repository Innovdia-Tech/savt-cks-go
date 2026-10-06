import { readFileSync } from "node:fs";
import {
  AdvertisingCarousel,
  AdvertisingSwipeGuard,
} from "./AdvertisingCarousel";
import { createElement } from "react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const slides = [
  {
    id: "fresh",
    eyebrow: "Fresh this week",
    title: "Everyday groceries, easy to find",
    action: { label: "Shop categories", target: "categories" as const },
  },
  {
    id: "essentials",
    eyebrow: "CKS Go",
    title: "Restock the cupboard from one place",
  },
];

type CarouselProps = {
  slides: typeof slides;
  onNavigate: () => void;
  embeddedHost?: boolean;
};

type AutoAdvanceState = {
  slideCount: number;
  reducedMotion: boolean;
  manuallyPaused: boolean;
  hoverPaused: boolean;
  focusPaused: boolean;
  inViewport: boolean;
  pageVisible: boolean;
};

type CarouselExports = {
  AdvertisingCarousel?: ComponentType<CarouselProps>;
  filterRenderableSlides?: (
    value: typeof slides,
    failed: ReadonlySet<string>,
  ) => typeof slides;
  isSupportedAdvertisingTarget?: (target: string) => boolean;
  shouldAutoAdvance?: (state: AutoAdvanceState) => boolean;
};

const loadCarousel = async () =>
  (await import("./components")) as typeof import("./components") &
    CarouselExports;

describe("Home advertising carousel", () => {
  it("uses customer backend slides in the production Home path", () => {
    const source = readFileSync(
      new URL("./components.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("productionAdvertisingSlides");
    expect(source).toContain("state.advertisements");
  });
  it("renders HQ artwork without CTA/text overlays and NONE has no button semantics", () => {
    const ad = {
      id: "hq",
      imageUrl: "/api/v1/advertisement-media/ad/asset",
      altText: "HQ creative",
      bannerAction: { type: "NONE" as const },
    };
    const html = renderToStaticMarkup(
      createElement(AdvertisingCarousel, {
        slides: [ad],
        onNavigate: () => {},
        onAction: () => {},
      }),
    );
    expect(html).toContain('alt="HQ creative"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("advertising-carousel__content");
    const actionable = renderToStaticMarkup(
      createElement(AdvertisingCarousel, {
        slides: [
          { ...ad, bannerAction: { type: "CATEGORY", categoryId: "category" } },
        ],
        onNavigate: () => {},
        onAction: () => {},
      }),
    );
    expect(actionable).toContain("advertising-carousel__banner-button");
    expect(actionable).toContain('aria-label="Browse category: HQ creative"');
    expect(actionable).not.toContain("Shop categories");
  });
  it("suppresses the click after a horizontal swipe, including a single banner", () => {
    const guard = new AdvertisingSwipeGuard();
    guard.start(200, 20);
    expect(guard.end(110, 23)).toBe(-1);
    expect(guard.allowClick()).toBe(false);
    guard.start(100, 20);
    expect(guard.end(101, 21)).toBe(0);
    expect(guard.allowClick()).toBe(true);
    guard.start(100, 20);
    expect(guard.end(104, 100)).toBe(0);
    expect(guard.allowClick()).toBe(false);
  });

  it("renders multiple slides with accessible manual and autoplay controls", async () => {
    const carousel = await loadCarousel();
    expect(carousel.AdvertisingCarousel).toBeTypeOf("function");
    const html = renderToStaticMarkup(
      createElement(carousel.AdvertisingCarousel!, {
        slides,
        onNavigate: () => {},
      }),
    );

    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Previous banner"');
    expect(html).toContain('aria-label="Next banner"');
    expect(html).toContain('aria-label="Pause banner rotation"');
    expect(html).toContain('aria-label="Show banner 2 of 2"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("https://");
  });

  it("uses swipe, named dots and an icon rotation control in the embedded host", async () => {
    const { AdvertisingCarousel } = await loadCarousel();
    const html = renderToStaticMarkup(
      createElement(AdvertisingCarousel!, {
        slides,
        onNavigate: () => {},
        embeddedHost: true,
      }),
    );
    expect(html).toContain('aria-label="Show banner 2 of 2"');
    expect(html).toContain('aria-label="Pause banner rotation"');
    expect(html).not.toContain('aria-label="Previous banner"');
    expect(html).not.toContain('aria-label="Next banner"');
    expect(html).not.toContain(">Pause</button>");
    expect(html).not.toContain(">Play</button>");
  });

  it("hides zero slides and keeps a single slide static", async () => {
    const { AdvertisingCarousel } = await loadCarousel();
    expect(AdvertisingCarousel).toBeTypeOf("function");
    expect(
      renderToStaticMarkup(
        createElement(AdvertisingCarousel!, {
          slides: [],
          onNavigate: () => {},
        }),
      ),
    ).toBe("");

    const html = renderToStaticMarkup(
      createElement(AdvertisingCarousel!, {
        slides: [slides[0]],
        onNavigate: () => {},
      }),
    );
    expect(html).toContain("Everyday groceries, easy to find");
    expect(html).not.toContain("Previous banner");
    expect(html).not.toContain("Pause banner rotation");
  });

  it("omits failed creatives and rejects unsupported destinations", async () => {
    const { filterRenderableSlides, isSupportedAdvertisingTarget } =
      await loadCarousel();
    expect(filterRenderableSlides).toBeTypeOf("function");
    expect(isSupportedAdvertisingTarget).toBeTypeOf("function");
    expect(filterRenderableSlides!(slides, new Set(["fresh"]))).toEqual([
      slides[1],
    ]);
    expect(isSupportedAdvertisingTarget!("categories")).toBe(true);
    expect(isSupportedAdvertisingTarget!("https://ads.example")).toBe(false);
    expect(isSupportedAdvertisingTarget!("cart")).toBe(false);
  });

  it("autoplays only when motion, visibility and interaction allow it", async () => {
    const { shouldAutoAdvance } = await loadCarousel();
    expect(shouldAutoAdvance).toBeTypeOf("function");
    const allowed = {
      slideCount: 2,
      reducedMotion: false,
      manuallyPaused: false,
      hoverPaused: false,
      focusPaused: false,
      inViewport: true,
      pageVisible: true,
    };
    expect(shouldAutoAdvance!(allowed)).toBe(true);
    expect(shouldAutoAdvance!({ ...allowed, slideCount: 1 })).toBe(false);
    expect(shouldAutoAdvance!({ ...allowed, reducedMotion: true })).toBe(false);
    expect(shouldAutoAdvance!({ ...allowed, manuallyPaused: true })).toBe(
      false,
    );
    expect(shouldAutoAdvance!({ ...allowed, hoverPaused: true })).toBe(false);
    expect(shouldAutoAdvance!({ ...allowed, focusPaused: true })).toBe(false);
    expect(shouldAutoAdvance!({ ...allowed, inViewport: false })).toBe(false);
    expect(shouldAutoAdvance!({ ...allowed, pageVisible: false })).toBe(false);
  });
});
