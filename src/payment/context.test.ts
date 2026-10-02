import { afterEach, describe, expect, it, vi } from "vitest";
import { installPaymentReturnObservers } from "./context";

class VisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  changeVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

const fixture = (visibilityState: DocumentVisibilityState = "visible") => {
  const documentTarget = new VisibilityTarget();
  documentTarget.visibilityState = visibilityState;
  const windowTarget = new EventTarget();
  vi.stubGlobal("window", windowTarget);
  const handleReturn = vi.fn(async () => {});
  const addListener = vi.spyOn(documentTarget, "addEventListener");
  const removeListener = vi.spyOn(documentTarget, "removeEventListener");
  const remove = installPaymentReturnObservers(documentTarget, {
    handleReturn,
  });
  return {
    documentTarget,
    windowTarget,
    handleReturn,
    addListener,
    removeListener,
    remove,
  };
};

afterEach(() => vi.unstubAllGlobals());

describe("payment return observation", () => {
  it("does nothing when installed on an already visible document", () => {
    const { documentTarget, handleReturn, remove } = fixture();
    expect(handleReturn).not.toHaveBeenCalled();
    documentTarget.changeVisibility("visible");
    expect(handleReturn).not.toHaveBeenCalled();
    remove();
  });

  it("ignores focus events without a hidden-to-visible transition", () => {
    const { documentTarget, windowTarget, handleReturn, remove } = fixture();
    windowTarget.dispatchEvent(new Event("focus"));
    expect(handleReturn).not.toHaveBeenCalled();
    documentTarget.changeVisibility("hidden");
    windowTarget.dispatchEvent(new Event("focus"));
    expect(handleReturn).not.toHaveBeenCalled();
    remove();
  });

  it("handles a hidden-to-visible transition exactly once", () => {
    const { documentTarget, handleReturn, remove } = fixture();
    documentTarget.changeVisibility("hidden");
    documentTarget.changeVisibility("hidden");
    expect(handleReturn).not.toHaveBeenCalled();
    documentTarget.changeVisibility("visible");
    expect(handleReturn).toHaveBeenCalledTimes(1);
    remove();
  });

  it("ignores repeated visible and focus events after a return", () => {
    const { documentTarget, windowTarget, handleReturn, remove } = fixture();
    documentTarget.changeVisibility("hidden");
    documentTarget.changeVisibility("visible");
    expect(handleReturn).toHaveBeenCalledTimes(1);
    documentTarget.changeVisibility("visible");
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.changeVisibility("visible");
    windowTarget.dispatchEvent(new Event("focus"));
    expect(handleReturn).toHaveBeenCalledTimes(1);
    remove();
  });

  it("handles a second return only after another hidden transition", () => {
    const { documentTarget, handleReturn, remove } = fixture();
    documentTarget.changeVisibility("hidden");
    documentTarget.changeVisibility("visible");
    expect(handleReturn).toHaveBeenCalledTimes(1);
    documentTarget.changeVisibility("visible");
    expect(handleReturn).toHaveBeenCalledTimes(1);
    documentTarget.changeVisibility("hidden");
    expect(handleReturn).toHaveBeenCalledTimes(1);
    documentTarget.changeVisibility("visible");
    expect(handleReturn).toHaveBeenCalledTimes(2);
    remove();
  });

  it("observes a return when the document is already hidden on install", () => {
    const { documentTarget, handleReturn, remove } = fixture("hidden");
    expect(handleReturn).not.toHaveBeenCalled();
    documentTarget.changeVisibility("visible");
    expect(handleReturn).toHaveBeenCalledTimes(1);
    documentTarget.changeVisibility("visible");
    expect(handleReturn).toHaveBeenCalledTimes(1);
    remove();
  });

  it("removes the visibility listener and ignores events after cleanup", () => {
    const {
      documentTarget,
      windowTarget,
      handleReturn,
      addListener,
      removeListener,
      remove,
    } = fixture();
    const listener = addListener.mock.calls[0][1];
    documentTarget.changeVisibility("hidden");
    remove();
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(
      "visibilitychange",
      listener,
    );
    documentTarget.changeVisibility("visible");
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.changeVisibility("hidden");
    documentTarget.changeVisibility("visible");
    expect(handleReturn).not.toHaveBeenCalled();
  });
});
