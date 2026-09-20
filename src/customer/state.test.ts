import { describe, it, expect, vi } from "vitest";
import { CustomerDataController } from "./state";
import { CustomerDataApi } from "./api";
import { DevelopmentDataAdapter } from "./development";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import type { AddressInput } from "../addresses/contracts";
const input: AddressInput = {
  label: "New demo",
  recipientName: "Synthetic",
  addressLine1: "1 Example",
  city: "Demo",
  state: "Sabah",
  countryCode: "MY",
};
async function setup(scenario = "mixed") {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  const adapter = new DevelopmentDataAdapter(false, scenario);
  const api = new CustomerDataApi("", session, adapter.fetch);
  const state = new CustomerDataController(api, session);
  await session.start();
  await state.load();
  return { session, adapter, state };
}
describe("customer data state and synthetic transport", () => {
  it("fails closed in production", () =>
    expect(() => new DevelopmentDataAdapter(true)).toThrow());
  it("loads profile and selects the active default", async () => {
    const { state } = await setup();
    expect(state.getSnapshot()).toMatchObject({
      profilePhase: "ready",
      listPhase: "ready",
      profile: { nameSnapshot: "Synthetic member", savtSyncStatus: "SYNCED" },
    });
    expect(state.selectedAddress()?.label).toBe("Demo home");
    expect(state.getSnapshot().addresses.map((a) => a.status)).toEqual([
      "ACTIVE",
      "INACTIVE",
      "ACTIVE",
      "ACTIVE",
    ]);
  });
  it("preserves stale profile indication and empty addresses", async () => {
    const { state } = await setup("stale");
    expect(state.getSnapshot().profile?.savtSyncStatus).toBe("STALE");
    const empty = await setup("empty");
    expect(empty.state.getSnapshot().addresses).toEqual([]);
    expect(empty.state.selectedAddress()).toBeUndefined();
  });
  it("creates, edits, defaults, deactivates and reactivates using current server versions", async () => {
    const { state } = await setup("empty");
    await state.mutate("create", undefined, input);
    let a = state.getSnapshot().addresses[0];
    expect(a.label).toBe("New demo");
    await state.mutate("edit", a.id, { ...input, label: "Edited" });
    a = state.getSnapshot().addresses[0];
    expect(a).toMatchObject({ label: "Edited", rowVersion: 2 });
    await state.mutate("default", a.id);
    expect(state.selectedAddress()?.isDefault).toBe(true);
    await state.mutate("deactivate", a.id);
    expect(state.selectedAddress()).toBeUndefined();
    await state.mutate("reactivate", a.id);
    expect(state.selectedAddress()).toMatchObject({
      status: "ACTIVE",
      isDefault: false,
      rowVersion: 5,
    });
  });
  it("preserves an explicit active checkout choice and clears it when inactive", async () => {
    const { state } = await setup();
    await state.mutate("create", undefined, input);
    const second = state
      .getSnapshot()
      .addresses.find((a) => a.label === "New demo")!;
    state.select(second.id);
    await state.load();
    expect(state.selectedAddress()?.id).toBe(second.id);
    await state.mutate("deactivate", second.id);
    expect(state.selectedAddress()?.label).toBe("Demo home");
    state.select(second.id);
    expect(state.selectedAddress()?.label).toBe("Demo home");
  });
  it("reloads all row versions when a different default is set", async () => {
    const { state } = await setup();
    const old = state.selectedAddress()!;
    await state.mutate("create", undefined, { ...input, isDefault: true });
    expect(
      state.getSnapshot().addresses.find((a) => a.id === old.id),
    ).toMatchObject({ isDefault: false, rowVersion: 2 });
  });
  it("blocks silent overwrite after conflict until explicit reload", async () => {
    const { state, adapter } = await setup();
    const id = state.selectedAddress()!.id;
    adapter.failNext("conflict");
    await state.mutate("edit", id, input);
    expect(state.getSnapshot().error?.category).toBe("conflict");
    await state.mutate("edit", id, input);
    expect(state.getSnapshot().addresses[0].label).toBe("Demo home");
    await state.load();
    await state.mutate("edit", id, input);
    expect(state.getSnapshot().addresses[0].label).toBe("New demo");
  });
  it.each(["offline", "retryable", "lostResponse"])(
    "retries %s without duplicate creation",
    async (failure) => {
      const { state, adapter } = await setup("empty");
      adapter.failNext(failure);
      await state.mutate("create", undefined, input);
      expect(state.getSnapshot().canRetryOperation).toBe(true);
      await state.mutate("create", undefined, { ...input, label: "Changed" });
      await state.retryOperation();
      expect(state.getSnapshot().addresses).toHaveLength(1);
      expect(state.getSnapshot().addresses[0].label).toBe("New demo");
    },
  );
  it("makes deactivated accounts read-only", async () => {
    const { state } = await setup("readonly");
    expect(state.getSnapshot().readOnly).toBe(true);
    await state.mutate("create", undefined, input);
    expect(state.getSnapshot().addresses).toHaveLength(4);
  });
  it("clears profile, addresses, choice, and pending action on logout", async () => {
    const { state, session, adapter } = await setup();
    adapter.failNext("offline");
    await state.mutate("create", undefined, input);
    await session.logout();
    expect(state.getSnapshot()).toMatchObject({
      profile: null,
      addresses: [],
      selectedId: null,
      canRetryOperation: false,
    });
  });
  it("clears all data on API session expiry", async () => {
    const { state, session, adapter } = await setup();
    adapter.failNext("expired");
    await state.load();
    expect(session.getSnapshot().phase).toBe("expired");
    expect(state.getSnapshot()).toMatchObject({
      profile: null,
      addresses: [],
      selectedId: null,
    });
  });
  it("does not resurrect data when a load completes after logout", async () => {
    const { state, session, adapter } = await setup();
    let release!: () => void;
    const original = adapter.fetch;
    adapter.fetch = vi.fn(async (...args: Parameters<typeof fetch>) => {
      await new Promise<void>((r) => {
        release = r;
      });
      return original(...args);
    });
    const slow = new CustomerDataController(
      new CustomerDataApi("", session, adapter.fetch),
      session,
    );
    const pending = slow.load();
    await session.logout();
    release();
    await pending;
    expect(slow.getSnapshot().addresses).toEqual([]);
    expect(state.getSnapshot().profile).toBeNull();
  });
  it("works without browser storage or logging PII", async () => {
    const storage = {
      getItem: () => {
        throw Error("storage read");
      },
      setItem: () => {
        throw Error("storage write");
      },
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    const log = vi.spyOn(console, "log");
    try {
      const { state } = await setup();
      await state.mutate("create", undefined, input);
      expect(log).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      log.mockRestore();
    }
  });
});

it("does not repeat a committed mutation if refreshing the list fails", async () => {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  const adapter = new DevelopmentDataAdapter(false, "empty");
  const fetcher: typeof fetch = async (url, init) => {
    const result = await adapter.fetch(url, init);
    if (init?.method === "POST") adapter.failNext("offline");
    return result;
  };
  const state = new CustomerDataController(
    new CustomerDataApi("", session, fetcher),
    session,
  );
  await session.start();
  await state.load();
  await state.mutate("create", undefined, input);
  expect(state.getSnapshot()).toMatchObject({
    listPhase: "error",
    canRetryOperation: false,
    notice: expect.stringContaining("Address saved"),
  });
  await state.load();
  expect(state.getSnapshot().addresses).toHaveLength(1);
});
it("shows profile loading until a response arrives", async () => {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  const adapter = new DevelopmentDataAdapter(false, "empty");
  let release!: () => void;
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith("/me"))
      await new Promise<void>((r) => {
        release = r;
      });
    return adapter.fetch(url, init);
  };
  const state = new CustomerDataController(
    new CustomerDataApi("", session, fetcher),
    session,
  );
  await session.start();
  const pending = state.load();
  expect(state.getSnapshot()).toMatchObject({
    profilePhase: "loading",
    profile: null,
  });
  release();
  await pending;
  expect(state.getSnapshot().profilePhase).toBe("ready");
});

it("follows a changed default until the customer explicitly chooses another address", async () => {
  const { state } = await setup();
  const original = state.selectedAddress()!;
  await state.mutate("create", undefined, { ...input, isDefault: true });
  expect(state.selectedAddress()?.label).toBe("New demo");
  state.select(original.id);
  await state.load();
  expect(state.selectedAddress()?.id).toBe(original.id);
});
