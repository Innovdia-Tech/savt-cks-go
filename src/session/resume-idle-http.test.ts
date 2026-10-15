import { expect, it } from "vitest";
import { CustomerApiClient } from "../api/client";
import type { NativeBridgePort } from "../webview/bridge";
import { CustomerSessionController } from "./controller";

// Accelerated HTTP fixture follows the unchanged deployed 900000ms idle policy.
// Native and backend policy are independently verified in their own tests.
it.each([5, 16, 20])(
  "handles %i-minute lock with fresh one-use credentials only when expired",
  async (minutes) => {
    let now = Date.parse("2026-10-13T01:00:00Z"),
      lastSeen = now,
      authenticated = false;
    let launch = 0,
      grants = 0;
    const consumed = new Set<string>(),
      routes: string[] = [];
    const sessionData = () => ({
      authenticated: true,
      expiresAt: new Date(now + 900_000).toISOString(),
      csrfToken: "D".repeat(43),
    });
    const fetcher: typeof fetch = async (input, init) => {
      const path = new URL(String(input)).pathname;
      routes.push(`${init?.method ?? "GET"} ${path}`);
      if (path.endsWith("/session")) {
        if (!authenticated || now - lastSeen >= 900_000)
          return Response.json(
            {
              error: {
                code: "CUSTOMER_SESSION_INVALID",
                message: "Session is no longer valid.",
              },
            },
            { status: 401 },
          );
        lastSeen = now;
        return Response.json({ data: sessionData() });
      }
      if (path.endsWith("/bootstrap")) {
        launch++;
        authenticated = false;
        return Response.json({
          data: {
            protocolVersion: "1",
            launchRequestId: `10000000-0000-4000-8000-${String(launch).padStart(12, "0")}`,
            state: "A".repeat(43),
            codeChallenge: "B".repeat(43),
            codeChallengeMethod: "S256",
            expiresAt: new Date(now + 60_000).toISOString(),
          },
        });
      }
      if (path.endsWith("/exchange")) {
        const body = JSON.parse(String(init?.body));
        expect(consumed.has(body.code)).toBe(false);
        consumed.add(body.code);
        authenticated = true;
        lastSeen = now;
        return Response.json({ data: sessionData() });
      }
      throw new Error(`Unexpected purchase/mutation route: ${path}`);
    };
    const bridge: NativeBridgePort = {
      requestLaunchCode: async (bootstrap) => ({
        protocolVersion: "1",
        launchRequestId: bootstrap.launchRequestId,
        state: bootstrap.state,
        code: String.fromCharCode(65 + launch).repeat(43),
      }),
      requestSessionRecovery: async () => {
        grants++;
      },
      notifySessionValidated: () => {},
      notifyLoaded: () => {},
      notifyError: () => {
        throw new Error("Unexpected terminal error");
      },
      requestPaymentHandoff: async () => {
        throw new Error("Payment must not replay");
      },
    };
    const controller = new CustomerSessionController(
      new CustomerApiClient("https://fixture.invalid", fetcher),
      bridge,
      { entryMode: "embedded" },
    );
    await controller.start();
    const before = routes.length;
    now += minutes * 60_000;
    expect(await controller.resume()).toBe(true);
    expect(controller.getSnapshot().phase).toBe("authenticated");
    expect(grants).toBe(minutes < 15 ? 0 : 1);
    expect(consumed.size).toBe(minutes < 15 ? 1 : 2);
    expect(routes.slice(before)).toEqual(
      minutes < 15
        ? ["GET /api/v1/customer/session"]
        : [
            "GET /api/v1/customer/session",
            "POST /api/v1/customer/session/bootstrap",
            "POST /api/v1/customer/session/exchange",
          ],
    );
  },
);
