import type { CatalogueState } from "../catalogue/state";
import type { PaymentState } from "../payment/state";

export const PULL_REFRESH_THRESHOLD = 68;
export const PULL_REFRESH_CAP = 96;
export function canPullRefresh({
  route,
  phase,
  paymentFrozen,
  paymentPhase,
  blocked,
}: {
  route: string;
  phase: CatalogueState["phase"];
  paymentFrozen: boolean;
  paymentPhase: PaymentState["phase"];
  blocked: boolean;
}) {
  return (
    route === "home" &&
    ["ready", "no-service", "expired"].includes(phase) &&
    !paymentFrozen &&
    paymentPhase === "idle" &&
    !blocked
  );
}
export class PullRefreshGesture {
  private origin: { x: number; y: number } | null = null;
  private axis: "pending" | "vertical" = "pending";
  private distance = 0;
  start(x: number, y: number, scrollTop: number, enabled: boolean) {
    this.cancel();
    if (enabled && scrollTop <= 0) this.origin = { x, y };
  }
  move(x: number, y: number, scrollTop: number) {
    if (!this.origin) return 0;
    if (scrollTop > 0) {
      this.cancel();
      return 0;
    }
    const dx = Math.abs(x - this.origin.x),
      dy = y - this.origin.y;
    if (this.axis === "pending") {
      if (Math.max(dx, Math.abs(dy)) < 8) return 0;
      if (dy <= 0 || dy <= dx * 1.3) {
        this.cancel();
        return 0;
      }
      this.axis = "vertical";
    }
    this.distance = Math.min(PULL_REFRESH_CAP, Math.max(0, dy));
    return this.distance;
  }
  release() {
    const refresh =
      this.axis === "vertical" && this.distance >= PULL_REFRESH_THRESHOLD;
    this.cancel();
    return refresh;
  }
  cancel() {
    this.origin = null;
    this.axis = "pending";
    this.distance = 0;
  }
}
