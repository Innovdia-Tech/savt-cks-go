import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/Icons";

export type AdvertisingTarget = "categories";

export type AdvertisingSlide = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  theme?: "berry" | "forest" | "sunrise" | "reference";
  action?: {
    label: string;
    target: AdvertisingTarget;
  };
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

export const isSupportedAdvertisingTarget = (
  target: string,
): target is AdvertisingTarget => target === "categories";

export const filterRenderableSlides = <T extends { id: string }>(
  slides: readonly T[],
  failedIds: ReadonlySet<string>,
) => slides.filter((slide) => !failedIds.has(slide.id));

export const shouldAutoAdvance = (state: AutoAdvanceState) =>
  state.slideCount > 1 &&
  !state.reducedMotion &&
  !state.manuallyPaused &&
  !state.hoverPaused &&
  !state.focusPaused &&
  state.inViewport &&
  state.pageVisible;

const nextIndex = (current: number, direction: number, length: number) =>
  (current + direction + length) % length;

export function AdvertisingCarousel({
  slides,
  onNavigate,
  label = "Featured shopping",
}: {
  slides: readonly AdvertisingSlide[];
  onNavigate: (target: AdvertisingTarget) => void;
  label?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const renderableSlides = useMemo(
    () => filterRenderableSlides(slides, failedIds),
    [slides, failedIds],
  );
  const multiple = renderableSlides.length > 1;

  useEffect(() => {
    if (current >= renderableSlides.length) setCurrent(0);
  }, [current, renderableSlides.length]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [renderableSlides.length]);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (
      !shouldAutoAdvance({
        slideCount: renderableSlides.length,
        reducedMotion,
        manuallyPaused,
        hoverPaused,
        focusPaused,
        inViewport,
        pageVisible,
      })
    )
      return;
    const timer = window.setTimeout(
      () => setCurrent((value) => nextIndex(value, 1, renderableSlides.length)),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [
    current,
    renderableSlides.length,
    reducedMotion,
    manuallyPaused,
    hoverPaused,
    focusPaused,
    inViewport,
    pageVisible,
  ]);

  if (renderableSlides.length === 0) return null;

  const show = (index: number) => {
    setManuallyPaused(true);
    setCurrent(index);
  };
  const move = (direction: number) =>
    show(nextIndex(current, direction, renderableSlides.length));
  const handleFocusOut = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      setFocusPaused(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!multiple || (event.key !== "ArrowLeft" && event.key !== "ArrowRight"))
      return;
    if ((event.target as HTMLElement).closest(".advertising-carousel__content"))
      return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  };
  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || !multiple) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    move(deltaX < 0 ? 1 : -1);
  };

  return (
    <section
      ref={root}
      className="advertising-carousel"
      aria-label={label}
      aria-roledescription="carousel"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={handleFocusOut}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
    >
      <div
        className={`advertising-carousel__track ${reducedMotion ? "is-reduced" : ""}`}
        style={{ transform: `translateX(-${current * 100}%)` }}
        aria-live={manuallyPaused ? "polite" : "off"}
      >
        {renderableSlides.map((slide, index) => {
          const active = index === current;
          const action =
            active &&
            slide.action &&
            isSupportedAdvertisingTarget(slide.action.target)
              ? slide.action
              : undefined;
          return (
            <article
              key={slide.id}
              className={`advertising-carousel__slide advertising-carousel__slide--${slide.theme ?? "berry"}`}
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${renderableSlides.length}`}
              aria-hidden={!active}
              inert={!active ? true : undefined}
            >
              {slide.imageUrl && (
                <img
                  className="advertising-carousel__artwork"
                  src={slide.imageUrl}
                  alt=""
                  aria-hidden="true"
                  onError={() =>
                    setFailedIds((ids) => new Set(ids).add(slide.id))
                  }
                />
              )}
              <div className="advertising-carousel__content">
                {slide.eyebrow && <span>{slide.eyebrow}</span>}
                <h2>{slide.title}</h2>
                {slide.description && <p>{slide.description}</p>}
                {action && (
                  <button
                    type="button"
                    onClick={() => {
                      setManuallyPaused(true);
                      onNavigate(action.target);
                    }}
                  >
                    {action.label}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {multiple && (
        <div className="advertising-carousel__controls">
          <button
            type="button"
            className="advertising-carousel__arrow"
            aria-label="Previous banner"
            onClick={() => move(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <div
            className="advertising-carousel__dots"
            aria-label="Choose banner"
          >
            {renderableSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show banner ${index + 1} of ${renderableSlides.length}`}
                aria-current={current === index ? "true" : undefined}
                onClick={() => show(index)}
              />
            ))}
          </div>
          <button
            type="button"
            className="advertising-carousel__play"
            aria-label={
              manuallyPaused ? "Play banner rotation" : "Pause banner rotation"
            }
            disabled={reducedMotion}
            onClick={() => setManuallyPaused((paused) => !paused)}
          >
            {manuallyPaused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            className="advertising-carousel__arrow"
            aria-label="Next banner"
            onClick={() => move(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </section>
  );
}
