import { describe, expect, it, vi } from "vitest";
import { installPaymentReturnObservers } from "./context";

class VisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

describe("payment return observation", () => {
  it("observes visible focus and visibility returns without initiating payment", () => {
    const documentTarget = new VisibilityTarget();
    const windowTarget = new EventTarget();
    const handleReturn = vi.fn(async () => {});
    const initiate = vi.fn();
    const remove = installPaymentReturnObservers(documentTarget, windowTarget, {
      handleReturn,
      initiate,
    } as never);

    documentTarget.visibilityState = "hidden";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(handleReturn).not.toHaveBeenCalled();

    documentTarget.visibilityState = "visible";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    windowTarget.dispatchEvent(new Event("focus"));
    expect(handleReturn).toHaveBeenCalledTimes(2);
    expect(initiate).not.toHaveBeenCalled();

    remove();
    windowTarget.dispatchEvent(new Event("focus"));
    expect(handleReturn).toHaveBeenCalledTimes(2);
  });
});
