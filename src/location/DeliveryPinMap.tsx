import { useEffect, useRef, useState } from "react";

export type PinCoordinate = { latitude: number; longitude: number };
export type MapStatus = "loading" | "ready" | "unavailable";
export interface PinMapInstance {
  recenter(center: PinCoordinate): void;
  dispose(): void;
}
export interface PinMapAdapter {
  mount(
    element: HTMLElement,
    center: PinCoordinate,
    onIdle: (center: PinCoordinate) => void,
    onFailure: () => void,
    onMove: () => void,
  ): Promise<PinMapInstance>;
}

type GoogleMap = {
  getCenter(): { lat(): number; lng(): number } | null;
  panTo(center: { lat: number; lng: number }): void;
  addListener(event: string, callback: () => void): { remove(): void };
};
type GoogleMaps = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => GoogleMap;
};
declare global {
  interface Window {
    google?: { maps?: GoogleMaps };
    gm_authFailure?: () => void;
  }
}

let loader: Promise<GoogleMaps> | undefined;
const authFailures = new Set<() => void>();
let authFailureInstalled = false;
function installAuthFailureHandler() {
  if (authFailureInstalled) return;
  authFailureInstalled = true;
  const previous = window.gm_authFailure;
  window.gm_authFailure = () => {
    for (const fail of authFailures) fail();
    previous?.();
  };
}
function loadGoogleMaps(key: string): Promise<GoogleMaps> {
  if (!key.trim()) return Promise.reject(new Error("Map unavailable"));
  installAuthFailureHandler();
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (loader) return loader;
  loader = new Promise<GoogleMaps>((resolve, reject) => {
    const callback = `__cksMapReady_${Math.random().toString(36).slice(2)}`;
    const global = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 10_000);
    const cleanup = () => {
      window.clearTimeout(timer);
      delete global[callback];
    };
    const fail = () => {
      cleanup();
      authFailures.delete(fail);
      script.remove();
      loader = undefined;
      reject(new Error("Map unavailable"));
    };
    global[callback] = () => {
      cleanup();
      authFailures.delete(fail);
      if (!window.google?.maps?.Map) return fail();
      resolve(window.google.maps);
    };
    script.onerror = fail;
    authFailures.add(fail);
    const url = new URL("https://maps.googleapis.com/maps/api/js");
    url.searchParams.set("key", key);
    url.searchParams.set("callback", callback);
    url.searchParams.set("loading", "async");
    url.searchParams.set("v", "weekly");
    url.searchParams.set("region", "MY");
    script.src = url.href;
    script.async = true;
    document.head.append(script);
  });
  return loader;
}

export function googlePinMapAdapter(key: string): PinMapAdapter {
  return {
    async mount(element, center, onIdle, onFailure, onMove) {
      const maps = await loadGoogleMaps(key);
      element.replaceChildren();
      authFailures.add(onFailure);
      let map: GoogleMap;
      try {
        map = new maps.Map(element, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 17,
          gestureHandling: "greedy",
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          clickableIcons: false,
        });
      } catch {
        authFailures.delete(onFailure);
        throw new Error("Map unavailable");
      }
      const listener = map.addListener("idle", () => {
        const current = map.getCenter();
        if (current)
          onIdle({ latitude: current.lat(), longitude: current.lng() });
      });
      const movementListener = map.addListener("center_changed", onMove);
      return {
        recenter(next) {
          map.panTo({ lat: next.latitude, lng: next.longitude });
        },
        dispose() {
          listener.remove();
          movementListener.remove();
          authFailures.delete(onFailure);
        },
      };
    },
  };
}

export function DeliveryPinMap({
  initial,
  adapter,
  onCandidate,
  onMove,
  onStatus,
  onRecenter,
}: {
  initial: PinCoordinate;
  adapter: PinMapAdapter;
  onCandidate: (center: PinCoordinate) => void;
  onMove: () => void;
  onStatus: (status: MapStatus) => void;
  onRecenter: () => Promise<PinCoordinate | null>;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const instance = useRef<PinMapInstance | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [recentering, setRecentering] = useState(false);
  const onCandidateRef = useRef(onCandidate);
  const onMoveRef = useRef(onMove);
  const onStatusRef = useRef(onStatus);
  const onRecenterRef = useRef(onRecenter);
  onCandidateRef.current = onCandidate;
  onMoveRef.current = onMove;
  onStatusRef.current = onStatus;
  onRecenterRef.current = onRecenter;

  useEffect(() => {
    let active = true;
    const update = (next: MapStatus) => {
      if (!active) return;
      setStatus(next);
      onStatusRef.current(next);
    };
    update("loading");
    if (!canvas.current) return;
    void adapter
      .mount(
        canvas.current,
        initial,
        (center) => {
          if (active) onCandidateRef.current(center);
        },
        () => update("unavailable"),
        () => {
          if (active) onMoveRef.current();
        },
      )
      .then((mounted) => {
        if (!active) return mounted.dispose();
        instance.current = mounted;
        update("ready");
      })
      .catch(() => update("unavailable"));
    return () => {
      active = false;
      instance.current?.dispose();
      instance.current = null;
    };
  }, [adapter, initial]);

  return (
    <div className="delivery-pin-map">
      {status === "unavailable" ? (
        <p role="alert" className="delivery-pin-map__error">
          We couldn't load the map right now.
        </p>
      ) : (
        <div className="delivery-pin-map__viewport">
          <div
            ref={canvas}
            className="delivery-pin-map__canvas"
            aria-label="Map"
          />
          {status === "loading" && (
            <div className="delivery-pin-map__loading" role="status">
              Loading map…
            </div>
          )}
          {status === "ready" && (
            <span
              className="delivery-pin-map__pin"
              aria-label="Centered delivery pin"
            >
              <span />
            </span>
          )}
        </div>
      )}
      {status === "ready" && (
        <button
          type="button"
          className="delivery-pin-map__recenter"
          disabled={recentering}
          onClick={() => {
            onMoveRef.current();
            setRecentering(true);
            void onRecenterRef.current().then((next) => {
              if (next) instance.current?.recenter(next);
              setRecentering(false);
            });
          }}
        >
          Recenter
        </button>
      )}
    </div>
  );
}
