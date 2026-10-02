import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BrowserBridgeAdapter,
  BridgeError,
  DevelopmentBridgeAdapter,
  FlutterBridgeAdapter,
  selectCustomerBridge,
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

  it("requests only an explicit external payment handoff over the native channel", async () => {
    const host = fixture();
    const bridge = new FlutterBridgeAdapter(host.environment);

    await expect(
      bridge.requestPaymentHandoff(
        "https://payments.example.test/checkout/approved",
      ),
    ).resolves.toBeUndefined();

    expect(host.postMessage).toHaveBeenCalledOnce();
    expect(JSON.parse(host.postMessage.mock.calls[0]![0])).toEqual({
      type: "payment-handoff",
      payload: {
        checkoutUrl: "https://payments.example.test/checkout/approved",
      },
    });
  });

  it.each([
    "http://payments.example.test/checkout",
    "https://user:secret@payments.example.test/checkout",
    "javascript:alert(1)",
    "not-a-url",
  ])("rejects unsafe payment handoff URL %s before posting", async (url) => {
    const host = fixture();
    const bridge = new FlutterBridgeAdapter(host.environment);
    await expect(bridge.requestPaymentHandoff(url)).rejects.toEqual(
      new BridgeError("invalid"),
    );
    expect(host.postMessage).not.toHaveBeenCalled();
  });

  it("fails closed when payment handoff is unavailable or throws", async () => {
    const unavailable = new FlutterBridgeAdapter({
      addHandoffListener: () => undefined,
      removeHandoffListener: () => undefined,
    });
    await expect(
      unavailable.requestPaymentHandoff("https://payments.example.test/pay"),
    ).rejects.toEqual(new BridgeError("unavailable"));

    const host = fixture();
    host.postMessage.mockImplementation(() => {
      throw new Error("native unavailable");
    });
    await expect(
      new FlutterBridgeAdapter(host.environment).requestPaymentHandoff(
        "https://payments.example.test/pay",
      ),
    ).rejects.toEqual(new BridgeError("unavailable"));
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

  it("records a safe payment handoff without asserting payment finality", async () => {
    const bridge = new DevelopmentBridgeAdapter(true, false);
    await bridge.requestPaymentHandoff(
      "https://payments.example.test/checkout/approved",
    );
    expect(bridge.getPaymentHandoffs()).toEqual([
      "https://payments.example.test/checkout/approved",
    ]);
    await expect(
      bridge.requestPaymentHandoff("http://payments.example.test/checkout"),
    ).rejects.toEqual(new BridgeError("invalid"));

    await expect(
      new DevelopmentBridgeAdapter(false, false).requestPaymentHandoff(
        "https://payments.example.test/checkout",
      ),
    ).rejects.toEqual(new BridgeError("unavailable"));
  });

  it("can fail one synthetic payment handoff and recover the same attempt", async () => {
    const bridge = new DevelopmentBridgeAdapter(true, false);
    bridge.failNextPaymentHandoff();
    const url = "https://payments.example.test/checkout/approved";
    await expect(bridge.requestPaymentHandoff(url)).rejects.toEqual(
      new BridgeError("unavailable"),
    );
    expect(bridge.getPaymentHandoffs()).toEqual([]);
    await expect(bridge.requestPaymentHandoff(url)).resolves.toBeUndefined();
    expect(bridge.getPaymentHandoffs()).toEqual([url]);
  });
});

describe("standalone browser payment handoff", () => {
  it("selects the browser adapter without changing native or development selection", () => {
    vi.stubGlobal("window", {
      SavtCksGoBridge: { postMessage: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    expect(selectCustomerBridge(false, false, true)).toBeInstanceOf(
      BrowserBridgeAdapter,
    );
    expect(selectCustomerBridge(true, false, true)).toBeInstanceOf(
      FlutterBridgeAdapter,
    );
    expect(selectCustomerBridge(false, true, false)).toBeInstanceOf(
      DevelopmentBridgeAdapter,
    );
    vi.unstubAllGlobals();
  });

  it("opens only a validated HTTPS checkout URL and cannot authorize a native launch", async () => {
    const navigate = vi.fn();
    const bridge = new BrowserBridgeAdapter(navigate);
    await expect(bridge.requestLaunchCode(bootstrap)).rejects.toEqual(
      new BridgeError("unavailable"),
    );
    await bridge.requestPaymentHandoff(
      "https://payments.example.test/checkout/approved",
    );
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      "https://payments.example.test/checkout/approved",
    );
    await expect(
      bridge.requestPaymentHandoff("http://payments.example.test/pay"),
    ).rejects.toEqual(new BridgeError("invalid"));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("reports navigation failure without exposing the checkout URL", async () => {
    const bridge = new BrowserBridgeAdapter(() => {
      throw new Error("private URL");
    });
    await expect(
      bridge.requestPaymentHandoff("https://payments.example.test/pay"),
    ).rejects.toEqual(new BridgeError("unavailable"));
  });
});

describe("local simulator browser payment handoff", () => {
  const checkoutUrl =
    "http://127.0.0.1:4312/api/integrations/cks-go/v1/payment-simulator/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv(
      "VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN",
      "http://127.0.0.1:4312",
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("opens the allowed simulator in a separate tab without replacing the app", async () => {
    const open = vi.fn(() => null);
    const navigate = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "http://127.0.0.1:5173/" },
      open,
    });
    await expect(
      new BrowserBridgeAdapter(navigate).requestPaymentHandoff(checkoutUrl),
    ).resolves.toBeUndefined();
    expect(open).toHaveBeenCalledExactlyOnceWith(
      checkoutUrl,
      "_blank",
      "noopener,noreferrer",
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports a thrown local tab opening failure using the existing safe error", async () => {
    const navigate = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "http://127.0.0.1:5173/" },
      open: () => {
        throw new Error("private checkout URL");
      },
    });
    await expect(
      new BrowserBridgeAdapter(navigate).requestPaymentHandoff(checkoutUrl),
    ).rejects.toEqual(new BridgeError("unavailable"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps HTTPS handoff on its existing same-tab navigation", async () => {
    const open = vi.fn();
    const navigate = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "http://127.0.0.1:5173/" },
      open,
    });
    await new BrowserBridgeAdapter(navigate).requestPaymentHandoff(
      "https://payments.example.test/checkout/approved",
    );
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      "https://payments.example.test/checkout/approved",
    );
    expect(open).not.toHaveBeenCalled();
  });
});
