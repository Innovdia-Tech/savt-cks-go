import { describe, expect, it, vi } from "vitest";
import { consumePaymentRecoveryFragment } from "./recovery";

const id = "20000000-0000-4000-8000-000000000002";

describe("native payment recovery fragment", () => {
  it("consumes only the opaque UUID and removes it from the visible host URL", () => {
    const history = { replaceState: vi.fn() };
    expect(
      consumePaymentRecoveryFragment(
        true,
        {
          hash: `#cks-go-payment-return=${id}`,
          pathname: "/cks/app",
          search: "?locale=en",
        },
        history,
      ),
    ).toBe(id);
    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/cks/app?locale=en#cart",
    );
  });
  it.each([
    "PAID",
    `${id}&status=PAID`,
    `${id}&token=secret`,
    `${id}?order=CONFIRMED`,
  ])("rejects state or credentials in recovery %s", (value) => {
    expect(
      consumePaymentRecoveryFragment(
        true,
        {
          hash: `#cks-go-payment-return=${value}`,
          pathname: "/",
          search: "",
        },
        { replaceState: vi.fn() },
      ),
    ).toBeNull();
  });
  it("does not restore an intent in a standalone browser", () => {
    const history = { replaceState: vi.fn() };
    expect(
      consumePaymentRecoveryFragment(
        false,
        {
          hash: `#cks-go-payment-return=${id}`,
          pathname: "/",
          search: "",
        },
        history,
      ),
    ).toBeNull();
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});
