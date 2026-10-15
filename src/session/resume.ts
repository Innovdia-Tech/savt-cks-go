import type { CustomerSessionController } from "./controller";

type VisibilityTarget = EventTarget & { readonly visibilityState: string };

export function installSessionResumeObservers(
  documentTarget: VisibilityTarget,
  windowTarget: EventTarget,
  controller: CustomerSessionController,
): () => void {
  let previous = documentTarget.visibilityState;
  const visible: EventListener = () => {
    const current = documentTarget.visibilityState;
    const returned = previous === "hidden" && current === "visible";
    previous = current;
    if (returned) void controller.resume();
  };
  const native: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as unknown;
    if (
      typeof detail === "object" &&
      detail !== null &&
      Object.keys(detail).length === 1 &&
      "type" in detail &&
      detail.type === "resume"
    )
      void controller.resume({ native: true });
  };
  const online: EventListener = () => {
    const state = controller.getSnapshot();
    if (
      documentTarget.visibilityState === "visible" &&
      state.phase === "authenticated" &&
      state.recovery === "offline" &&
      !state.manualRecovery
    )
      void controller.resume();
  };
  documentTarget.addEventListener("visibilitychange", visible);
  windowTarget.addEventListener("savt-cks-go-session", native);
  windowTarget.addEventListener("online", online);
  return () => {
    documentTarget.removeEventListener("visibilitychange", visible);
    windowTarget.removeEventListener("savt-cks-go-session", native);
    windowTarget.removeEventListener("online", online);
  };
}
