import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const playwright = (() => {
  try {
    return require("playwright");
  } catch {
    return require("C:/Users/isaac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  }
})();
export const directory = path.dirname(fileURLToPath(import.meta.url));
export const project = path.resolve(directory, "../..");
export const addressId = "22222222-2222-4222-8222-222222222222";
export const workId = "55555555-5555-4555-8555-555555555555";
const outletId = "11111111-1111-4111-8111-111111111111";
const productId = "66666666-6666-4666-8666-666666666666";
const categoryId = "77777777-7777-4777-8777-777777777777";
export const homeAddress = {
  id: addressId,
  label: "Home",
  recipientName: "Synthetic recipient",
  recipientPhoneE164: null,
  addressLine1: "1 Example Street",
  addressLine2: null,
  city: "Kota Kinabalu",
  state: "Sabah",
  postcode: "88000",
  countryCode: "MY",
  deliveryInstructions: null,
  latitude: 5.92,
  longitude: 116.08,
  isDefault: true,
  status: "ACTIVE",
  rowVersion: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
export const workAddress = {
  ...homeAddress,
  id: workId,
  label: "Work",
  addressLine1: "2 Example Street",
  isDefault: false,
};
export const advertisement = {
  id: "33333333-3333-4333-8333-333333333333",
  placement: "HOME_HERO",
  displayOrder: 1,
  altText: "HQ weekend grocery promotion",
  imageUrl:
    "/api/v1/advertisement-media/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444",
  startsAt: null,
  endsAt: null,
  action: { type: "NONE" },
};
export async function startFixtureServer(port = 5207, production = true) {
  let output = "";
  const process = spawn(
    globalThis.process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "verification/cust-ux-batch01/address.config.mjs",
      "--configLoader",
      "runner",
      "--mode",
      production ? "production" : "development",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
      "--force",
    ],
    {
      cwd: project,
      windowsHide: true,
      env: {
        ...globalThis.process.env,
        NODE_ENV: production ? "production" : "development",
      },
    },
  );
  process.stdout.on("data", (value) => {
    output += value;
  });
  process.stderr.on("data", (value) => {
    output += value;
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (process.exitCode !== null)
      throw new Error(`Fixture server stopped: ${output}`);
    try {
      if (
        output.includes(origin) &&
        (
          await fetch(
            `${origin}/verification/cust-ux-batch01/address-fixture.html`,
          )
        ).ok
      )
        return { process, origin, output: () => output };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  process.kill();
  throw new Error(`Fixture server did not start: ${output}`);
}
export async function stopFixtureServer(server) {
  const child = server.process;
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      child.removeListener("close", finish);
      resolve(child.exitCode !== null || child.signalCode !== null);
    };
    const timer = setTimeout(finish, 5000);
    child.once("close", finish);
    child.kill();
  });
}
export async function installEmbeddedFixture(page, options = {}) {
  const trace = { requests: [], unexpectedRequests: [], errors: [] };
  const delayed = new Map();
  for (const stage of ["profile", "addresses", "assignment", "sessionExchange"])
    if (options[`delay${stage[0].toUpperCase()}${stage.slice(1)}`]) {
      let release;
      const promise = new Promise((resolve) => {
        release = resolve;
      });
      delayed.set(stage, { promise, release });
    }
  const timestamp = () => new Date().toISOString();
  page.on("pageerror", (error) => trace.errors.push(String(error)));
  await page.addInitScript(
    ({ locationDelay, locationStatus, holdLocation }) => {
      window.__embeddedTrace = {
        native: [],
        maps: [],
        replies: [],
        dropped: [],
        recenters: [],
      };
      const trace = window.__embeddedTrace;
      let locationInFlight = false;
      let releaseLocation;
      window.__releaseLocation = () => {
        const release = releaseLocation;
        releaseLocation = undefined;
        release?.();
      };
      window.SavtCksGoBridge = {
        postMessage: (raw) => {
          const message = JSON.parse(raw);
          trace.native.push({ message, at: performance.now() });
          if (message.type === "bootstrap")
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("savt-cks-go-handoff", {
                    detail: {
                      protocolVersion: "1",
                      launchRequestId: message.payload.launchRequestId,
                      state: message.payload.state,
                      code: "C".repeat(43),
                    },
                  }),
                ),
              10,
            );
          if (message.type === "location-current") {
            if (locationInFlight) {
              trace.dropped.push(message);
              return;
            }
            locationInFlight = true;
            const complete = () => {
              const detail = {
                protocolVersion: "1",
                requestId: message.requestId,
                status: locationStatus,
                latitude: locationStatus === "ok" ? 5.92 : null,
                longitude: locationStatus === "ok" ? 116.08 : null,
                formattedAddress:
                  locationStatus === "ok"
                    ? "1 Example Street, Kota Kinabalu, Sabah"
                    : null,
                addressLine1:
                  locationStatus === "ok" ? "1 Example Street" : null,
                city: locationStatus === "ok" ? "Kota Kinabalu" : null,
                state: locationStatus === "ok" ? "Sabah" : null,
                postcode: locationStatus === "ok" ? "88000" : null,
              };
              trace.replies.push({ detail, at: performance.now() });
              locationInFlight = false;
              window.dispatchEvent(
                new CustomEvent("savt-cks-go-location", { detail }),
              );
            };
            if (holdLocation) releaseLocation = complete;
            else setTimeout(complete, locationDelay);
          }
        },
      };
      window.google = {
        maps: {
          Map: class {
            constructor(element, options) {
              this.center = options.center;
              this.listeners = new Map();
              element.style.background = "#e5e7eb";
              element.textContent = "Synthetic map adapter boundary";
              trace.maps.push({
                center: options.center,
                at: performance.now(),
              });
            }
            getCenter() {
              return { lat: () => this.center.lat, lng: () => this.center.lng };
            }
            addListener(event, listener) {
              this.listeners.set(event, listener);
              if (event === "idle") setTimeout(listener, 5);
              return { remove: () => this.listeners.delete(event) };
            }
            panTo(center) {
              this.center = center;
              trace.recenters.push(center);
              this.listeners.get("center_changed")?.();
              setTimeout(() => this.listeners.get("idle")?.(), 5);
            }
          },
        },
      };
    },
    {
      locationDelay: options.locationDelay ?? 40,
      locationStatus: options.locationStatus ?? "ok",
      holdLocation: options.holdLocation ?? false,
    },
  );
  const outlet = {
    id: outletId,
    displayReference: "FIXTURE",
    displayName: "Fixture delivery store",
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  };
  const profile = {
    id: outletId,
    savtMemberId: null,
    nameSnapshot: "Synthetic member",
    phoneE164Snapshot: null,
    membershipTier: "GOLD",
    savtMemberStatus: "ACTIVE",
    accountStatus: "ACTIVE",
    savtSyncStatus: "SYNCED",
    savtSyncedAt: "2026-09-01T00:00:00.000Z",
  };
  const addresses = options.addresses ?? [
    homeAddress,
    {
      ...workAddress,
      ...(options.workCoordinates === false
        ? { latitude: null, longitude: null }
        : {}),
    },
  ];
  const session = {
    authenticated: true,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    csrfToken: "D".repeat(43),
  };
  let assignmentExpiry;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON();
    const entry = {
      method: request.method(),
      path: url.pathname + url.search,
      body,
      at: timestamp(),
    };
    trace.requests.push(entry);
    const respond = async (data, stage, status = 200) => {
      if (delayed.has(stage)) await delayed.get(stage).promise;
      entry.status = status;
      entry.completedAt = timestamp();
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    };
    if (url.pathname === "/api/v1/customer/session")
      return respond(
        options.sessionMode === "fresh"
          ? {
              error: {
                code: "CUSTOMER_SESSION_INVALID",
                message: "Fixture session unavailable",
              },
            }
          : { data: session },
        null,
        options.sessionMode === "fresh" ? 401 : 200,
      );
    if (url.pathname === "/api/v1/customer/session/bootstrap")
      return respond({
        data: {
          protocolVersion: "1",
          launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
          state: "A".repeat(43),
          codeChallenge: "B".repeat(43),
          codeChallengeMethod: "S256",
          expiresAt: session.expiresAt,
        },
      });
    if (url.pathname === "/api/v1/customer/session/exchange")
      return respond({ data: session }, "sessionExchange");
    if (url.pathname === "/api/v1/customer/me")
      return respond({ data: profile }, "profile");
    if (url.pathname === "/api/v1/customer/me/addresses")
      return respond({ data: addresses }, "addresses");
    if (url.pathname === "/api/v1/customer/support")
      return respond({ data: { whatsapp: "" } });
    const now = new Date().toISOString(),
      expiry = new Date(Date.now() + 300000).toISOString();
    if (url.pathname === "/api/v1/customer/outlet-assignment") {
      if (options.failWorkAssignment && body.customerAddressId === workId)
        return respond(
          {
            error: {
              code: "CUSTOMER_ASSIGNMENT_INCOMPLETE",
              message: "Fixture delivery check failed",
            },
          },
          null,
          409,
        );
      assignmentExpiry = expiry;
      return respond(
        {
          data: {
            assignmentContextId: "A".repeat(43),
            customerAddressId: body.customerAddressId,
            addressRowVersion: body.addressRowVersion,
            outlet,
            resolvedAt: now,
            expiresAt: expiry,
          },
          meta: { asOf: now },
        },
        "assignment",
      );
    }
    const meta = {
      outlet,
      assignmentContextExpiresAt: assignmentExpiry ?? expiry,
      asOf: now,
      page: 1,
      pageSize: url.pathname.endsWith("categories") ? 50 : 24,
      total: 1,
      hasNextPage: false,
    };
    if (url.pathname.endsWith("/categories"))
      return respond({
        data: [{ id: categoryId, code: "GROCERY", name: "Grocery" }],
        meta,
      });
    if (url.pathname.endsWith("/products"))
      return respond({
        data: [
          {
            productId,
            outletProductId: "88888888-8888-4888-8888-888888888888",
            name: "Fixture rice",
            imageUrl: null,
            category: { id: categoryId, name: "Grocery" },
            subcategory: null,
            brand: null,
            uom: { code: "PACK", name: "Pack" },
            packSize: "1 kg",
            sellingPriceMinor: 850,
            currency: "MYR",
            availability: "AVAILABLE",
          },
        ],
        meta,
      });
    if (url.pathname === "/api/v1/customer/advertisements")
      return respond({
        data:
          options.advertisements === "live"
            ? [advertisement]
            : (options.advertisements ?? []),
      });
    if (url.pathname.startsWith("/api/v1/advertisement-media/"))
      return route.fulfill({
        status: 200,
        contentType: "image/gif",
        body: Buffer.from(
          "R0lGODlhAQABAIAAAMjIyAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
          "base64",
        ),
      });
    if (url.pathname === "/api/v1/customer/location/reverse")
      return respond({
        data: {
          formattedAddress: "1 Example Street, Kota Kinabalu, Sabah",
          addressLine1: "1 Example Street",
          city: "Kota Kinabalu",
          state: "Sabah",
          postcode: "88000",
          countryCode: "MY",
          latitude: body.latitude,
          longitude: body.longitude,
        },
      });
    if (url.pathname === "/api/v1/customer/location/search")
      return respond({
        data: {
          suggestions: options.searchSuggestions
            ? [
                {
                  placeId: "fixture-place",
                  primaryText: "Fixture search location",
                  secondaryText: "Kota Kinabalu, Sabah",
                  distanceMeters: null,
                },
              ]
            : [],
        },
      });
    if (url.pathname === "/api/v1/customer/location/resolve")
      return respond({
        data: {
          placeId: "fixture-place",
          formattedAddress: "2 Example Street, Kota Kinabalu, Sabah",
          addressLine1: "2 Example Street",
          city: "Kota Kinabalu",
          state: "Sabah",
          postcode: "88000",
          countryCode: "MY",
          latitude: 5.93,
          longitude: 116.09,
        },
      });
    trace.unexpectedRequests.push(entry);
    return respond(
      {
        error: {
          code: "FIXTURE_UNKNOWN_REQUEST",
          message: "Unexpected fixture request",
        },
      },
      null,
      500,
    );
  });
  return {
    trace,
    release: (stage) =>
      stage === "location"
        ? page.evaluate(() => window.__releaseLocation())
        : delayed.get(stage)?.release(),
    snapshot: async () => ({
      ...trace,
      embedded: await page.evaluate(() => window.__embeddedTrace),
    }),
  };
}
