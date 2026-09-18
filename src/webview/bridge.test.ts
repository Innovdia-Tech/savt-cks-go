import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BridgeError,
  DevelopmentBridgeAdapter,
  FlutterBridgeAdapter,
  type BridgeEnvironment,
  type HandoffDetail,
} from "./bridge";

const bootstrap = {
  protocolVersion: "1" as const,
  launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
  state: "A".repeat(43),
  codeChallenge: "B".repeat(43),
  codeChallengeMethod: "S256" as const,
};

const handoff = (overrides: Partial<HandoffDetail> = {}): HandoffDetail => ({
  protocolVersion: "1",
  launchRequestId: bootstrap.launchRequestId,
  state: bootstrap.state,
  code: "C".repeat(43),
  ...overrides,
});

const fixture = () => {
  let listener: ((detail: unknown) => void) | undefined;
  const postMessage = vi.fn();
  const environment: BridgeEnvironment = {
    channel: { postMessage },
    addHandoffListener: (next) => {
      listener = next;
    },
    removeHandoffListener: (next) => {
      if (listener === next) listener = undefined;
    },
  };
  return {
    environment,
    postMessage,
    emit: (detail: unknown) => listener?.(detail),
  };
};

describe("FlutterBridgeAdapter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("posts the exact protocol-v1 bootstrap message and accepts one matching handoff", async () => {
    const host = fixture();
    const promise = new FlutterBridgeAdapter(
      host.environment,
      20_000,
    ).requestLaunchCode(bootstrap);
    expect(JSON.parse(host.postMessage.mock.calls[0]![0])).toEqual({
      type: "bootstrap",
      payload: bootstrap,
    });

    host.emit(handoff());
    await expect(promise).resolves.toEqual(handoff());
  });

  it.each([
    { ...handoff(), extra: "field" },
    handoff({ protocolVersion: "2" as "1" }),
    handoff({ launchRequestId: "81b0e2ce-d86f-4f60-8fd8-c995c55007b2" }),
    handoff({ state: "D".repeat(43) }),
    { protocolVersion: "1" },
  ])(
    "rejects malformed, expanded or mismatched handoff messages",
    async (message) => {
      const host = fixture();
      const promise = new FlutterBridgeAdapter(
        host.environment,
        20_000,
      ).requestLaunchCode(bootstrap);
      host.emit(message);
      await expect(promise).rejects.toMatchObject({ kind: "invalid" });
    },
  );

  it("rejects duplicate launch request IDs", async () => {
    const host = fixture();
    const bridge = new FlutterBridgeAdapter(host.environment, 20_000);
    const first = bridge.requestLaunchCode(bootstrap);
    host.emit(handoff());
    await first;
    await expect(bridge.requestLaunchCode(bootstrap)).rejects.toMatchObject({
      kind: "invalid",
    });
  });

  it("times out a missing native response", async () => {
    const host = fixture();
    const promise = new FlutterBridgeAdapter(
      host.environment,
      20_000,
    ).requestLaunchCode(bootstrap);
    const rejection = expect(promise).rejects.toMatchObject({
      kind: "timeout",
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;
  });

  it("fails closed when the approved native channel is unavailable", async () => {
    const bridge = new FlutterBridgeAdapter({
      addHandoffListener: () => undefined,
      removeHandoffListener: () => undefined,
    });
    await expect(bridge.requestLaunchCode(bootstrap)).rejects.toEqual(
      new BridgeError("unavailable"),
    );
  });

  it("notifies Flutter with only the approved loaded and error messages", () => {
    const host = fixture();
    const bridge = new FlutterBridgeAdapter(host.environment);
    bridge.notifyLoaded();
    bridge.notifyError("CUSTOMER_SESSION_INVALID");
    expect(
      host.postMessage.mock.calls.map(([value]) => JSON.parse(value)),
    ).toEqual([
      { type: "loaded" },
      { type: "error", code: "CUSTOMER_SESSION_INVALID" },
    ]);
  });
});

describe("DevelopmentBridgeAdapter", () => {
  it("returns a synthetic one-use code only when explicitly enabled outside production", async () => {
    await expect(
      new DevelopmentBridgeAdapter(true, false).requestLaunchCode(bootstrap),
    ).resolves.toEqual(handoff({ code: "D".repeat(43) }));
    await expect(
      new DevelopmentBridgeAdapter(false, false).requestLaunchCode(bootstrap),
    ).rejects.toMatchObject({
      kind: "unavailable",
    });
    await expect(
      new DevelopmentBridgeAdapter(true, true).requestLaunchCode(bootstrap),
    ).rejects.toMatchObject({
      kind: "unavailable",
    });
  });
});
