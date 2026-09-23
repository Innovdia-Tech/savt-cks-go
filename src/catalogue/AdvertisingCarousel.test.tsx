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
