import { describe, expect, it, vi } from "vitest";
import { requestAddressSelection } from "./context";
import { id } from "./test-fixtures";

const selected = {
  id: id("b"),
  label: "Home",
  status: "ACTIVE",
  rowVersion: 7,
};

describe("cart-aware address selection", () => {
  it("commits the customer selection only after a same-outlet or empty-cart decision", async () => {
    const select = vi.fn();
    const requestAddress = vi.fn().mockResolvedValue("committed");
    await expect(
      requestAddressSelection(
        { requestAddress } as never,
        { getSnapshot: () => ({ addresses: [selected] }), select } as never,
        selected.id,
      ),
    ).resolves.toBe("committed");
    expect(requestAddress).toHaveBeenCalledWith(selected);
    expect(select).toHaveBeenCalledWith(selected.id);
  });

  it("does not commit the customer selection while clear-cart confirmation is pending", async () => {
    const select = vi.fn();
    const requestAddress = vi.fn().mockResolvedValue("confirmation");
    await expect(
      requestAddressSelection(
        { requestAddress } as never,
        { getSnapshot: () => ({ addresses: [selected] }), select } as never,
        selected.id,
      ),
    ).resolves.toBe("confirmation");
    expect(select).not.toHaveBeenCalled();
  });

  it("ignores inactive or unknown address identifiers", async () => {
    const select = vi.fn();
    const requestAddress = vi.fn();
    await expect(
      requestAddressSelection(
        { requestAddress } as never,
        {
          getSnapshot: () => ({
            addresses: [{ ...selected, status: "INACTIVE" }],
          }),
          select,
        } as never,
        selected.id,
      ),
    ).resolves.toBe("error");
    expect(requestAddress).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });
});
