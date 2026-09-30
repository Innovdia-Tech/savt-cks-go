import { afterEach, describe, expect, it, vi } from "vitest";
import { googlePinMapAdapter } from "./DeliveryPinMap";

afterEach(() => vi.unstubAllGlobals());

describe("Google pin map adapter", () => {
  it("fails closed without a browser Maps key", async () => {
    const adapter = googlePinMapAdapter("");
    await expect(
      adapter.mount(
        {} as HTMLElement,
        { latitude: 5.9186, longitude: 116.0818 },
        () => undefined,
        () => undefined,
      ),
    ).rejects.toThrow("Map unavailable");
  });

  it("centers the map, reports settled movement, and restores the original pin", async () => {
    const original = { latitude: 5.9186, longitude: 116.0818 };
    const moved = { latitude: 5.9188, longitude: 116.082 };
    const centers: (typeof original)[] = [];
    let map: FakeMap;
    class FakeMap {
      center = { lat: original.latitude, lng: original.longitude };
      listener?: () => void;
      removed = false;
      constructor(
        _element: HTMLElement,
        readonly options: Record<string, unknown>,
      ) {
        map = this;
      }
      getCenter() {
        return { lat: () => this.center.lat, lng: () => this.center.lng };
      }
      panTo(center: { lat: number; lng: number }) {
        this.center = center;
        this.listener?.();
      }
      addListener(event: string, callback: () => void) {
        expect(event).toBe("idle");
        this.listener = callback;
        return {
          remove: () => {
            this.removed = true;
          },
        };
      }
    }
    const fakeWindow = {
      google: { maps: { Map: FakeMap } },
      gm_authFailure: undefined as (() => void) | undefined,
    };
    vi.stubGlobal("window", fakeWindow);
    const element = { replaceChildren: vi.fn() } as unknown as HTMLElement;
    const unavailable = vi.fn();
    const adapter = googlePinMapAdapter("browser-visible-key");
    const mounted = await adapter.mount(
      element,
      original,
      (center) => centers.push(center),
      unavailable,
    );
    expect(element.replaceChildren).toHaveBeenCalledOnce();
    expect(map!.options).toMatchObject({
      center: { lat: original.latitude, lng: original.longitude },
      gestureHandling: "greedy",
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
    });
    map!.panTo({ lat: moved.latitude, lng: moved.longitude });
    expect(centers).toEqual([moved]);
    mounted.recenter(original);
    expect(centers).toEqual([moved, original]);
    fakeWindow.gm_authFailure?.();
    expect(unavailable).toHaveBeenCalledOnce();
    mounted.dispose();
    expect(map!.removed).toBe(true);
  });
});
