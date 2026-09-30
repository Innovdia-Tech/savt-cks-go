import type { PinCoordinate, PinMapAdapter } from "./DeliveryPinMap";

/** Local visual acceptance adapter. No Google script or network request is made. */
export const developmentPinMapAdapter: PinMapAdapter = {
  async mount(element, initial, onIdle) {
    if (new URLSearchParams(window.location.search).has("map-loading"))
      return new Promise(() => undefined);
    if (new URLSearchParams(window.location.search).has("map-unavailable"))
      throw new Error("Synthetic map unavailable");
    let center: PinCoordinate = initial;
    const testCenters = (
      globalThis as { __cksGoUx02MapCenters?: PinCoordinate[] }
    ).__cksGoUx02MapCenters;
    testCenters?.push({ ...center });
    const scene = document.createElement("div");
    scene.className = "delivery-pin-map__synthetic";
    const label = document.createElement("span");
    label.className = "delivery-pin-map__synthetic-label";
    label.textContent = "Synthetic map preview";
    scene.append(label);
    const road = document.createElement("span");
    road.className = "delivery-pin-map__synthetic-road";
    scene.append(road);
    const place = document.createElement("span");
    place.className = "delivery-pin-map__synthetic-place";
    place.textContent = "Penampang";
    scene.append(place);
    const controls = document.createElement("div");
    controls.className = "delivery-pin-map__synthetic-controls";
    const directions = [
      { title: "Pan map north", symbol: "↑", latitude: 0.0002, longitude: 0 },
      { title: "Pan map west", symbol: "←", latitude: 0, longitude: -0.0002 },
      { title: "Pan map east", symbol: "→", latitude: 0, longitude: 0.0002 },
      { title: "Pan map south", symbol: "↓", latitude: -0.0002, longitude: 0 },
    ];
    for (const direction of directions) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", direction.title);
      button.textContent = direction.symbol;
      button.addEventListener("click", () => {
        center = {
          latitude: center.latitude + direction.latitude,
          longitude: center.longitude + direction.longitude,
        };
        testCenters?.push({ ...center });
        scene.style.setProperty(
          "--pan-x",
          `${(center.longitude - initial.longitude) * -80000}px`,
        );
        scene.style.setProperty(
          "--pan-y",
          `${(center.latitude - initial.latitude) * 80000}px`,
        );
        onIdle(center);
      });
      controls.append(button);
    }
    scene.append(controls);
    element.append(scene);
    return {
      recenter(next) {
        center = next;
        testCenters?.push({ ...center });
        scene.style.setProperty("--pan-x", "0px");
        scene.style.setProperty("--pan-y", "0px");
        onIdle(center);
      },
      dispose() {
        scene.remove();
      },
    };
  },
};
