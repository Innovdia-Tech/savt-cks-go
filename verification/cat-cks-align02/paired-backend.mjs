/**
 * Evidence-only local HTTP fixture. The pinned Nest controllers, guards, DTOs,
 * exception filter, catalogue service and serializers execute unchanged.
 * Persistence, Savt identity, assignment context and readiness are synthetic.
 * No Prisma client is constructed and no backend file or database is written.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PINNED_BACKEND =
  "C:/Users/isaac/.codex/worktrees/cat-cks-align02/cks-go-m05b-clean";
export const PINNED_HEAD = "fe89d6c620fbb6b1b811f423becd233a078072e1";

const serializable = (value) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Minimal read-only interpretation of the actual service's Prisma predicates. */
function matches(value, predicate) {
  if (predicate === undefined) return true;
  if (predicate === null || typeof predicate !== "object")
    return value === predicate;
  if ("not" in predicate && matches(value, predicate.not)) return false;
  if ("equals" in predicate && !matches(value, predicate.equals)) return false;
  if ("gt" in predicate && !(value > predicate.gt)) return false;
  if ("gte" in predicate && !(value >= predicate.gte)) return false;
  if ("lt" in predicate && !(value < predicate.lt)) return false;
  if ("lte" in predicate && !(value <= predicate.lte)) return false;
  if ("contains" in predicate) {
    if (typeof value !== "string") return false;
    const insensitive = predicate.mode === "insensitive";
    const actual = insensitive ? value.toLowerCase() : value;
    const expected = insensitive
      ? String(predicate.contains).toLowerCase()
      : String(predicate.contains);
    if (!actual.includes(expected)) return false;
  }
  if (predicate.AND && !predicate.AND.every((part) => matches(value, part)))
    return false;
  if (predicate.OR && !predicate.OR.some((part) => matches(value, part)))
    return false;
  for (const [key, expected] of Object.entries(predicate)) {
    if (
      [
        "not",
        "equals",
        "gt",
        "gte",
        "lt",
        "lte",
        "contains",
        "mode",
        "AND",
        "OR",
      ].includes(key)
    )
      continue;
    if (value == null || !matches(value[key], expected)) return false;
  }
  return true;
}

const compare = (left, right, ordering) => {
  for (const order of ordering ?? []) {
    const [[key, direction]] = Object.entries(order);
    const delta =
      typeof direction === "object"
        ? compare(left[key], right[key], [direction])
        : String(left[key] ?? "").localeCompare(String(right[key] ?? "")) *
          (direction === "desc" ? -1 : 1);
    if (delta) return delta;
  }
  return 0;
};

function readOnlyTable(name, rows, observations) {
  const record = (method, args, result) => {
    observations.push({
      table: name,
      method,
      arguments: serializable(args),
      resultIds: Array.isArray(result)
        ? result.map((row) => row.id)
        : typeof result === "number"
          ? undefined
          : (result?.id ?? null),
      ...(typeof result === "number" ? { count: result } : {}),
    });
    return Promise.resolve(result);
  };
  const methods = {
    count(args) {
      return record(
        "count",
        args,
        rows.filter((row) => matches(row, args.where)).length,
      );
    },
    findMany(args) {
      const selected = rows
        .filter((row) => matches(row, args.where))
        .sort((left, right) => compare(left, right, args.orderBy));
      return record(
        "findMany",
        args,
        selected.slice(
          args.skip ?? 0,
          (args.skip ?? 0) + (args.take ?? selected.length),
        ),
      );
    },
    findFirst(args) {
      return record(
        "findFirst",
        args,
        rows.find((row) => matches(row, args.where)) ?? null,
      );
    },
  };
  return new Proxy(methods, {
    get(target, property) {
      if (property in target) return target[property];
      throw new Error(
        `Synthetic repository forbids ${name}.${String(property)}.`,
      );
    },
  });
}

async function buildProvenance() {
  const head = execFileSync(
    "git",
    ["-C", PINNED_BACKEND, "rev-parse", "HEAD"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  ).trim();
  assert.equal(
    head,
    PINNED_HEAD,
    "Backend moved from the approved local checkpoint.",
  );
  const paths = [
    "modules/customer-catalogue/customer-catalogue.controller",
    "modules/customer-catalogue/customer-catalogue.dtos",
    "modules/customer-catalogue/customer-catalogue.service",
    "modules/checkout/savt-customer-identity.guard",
    "common/customer-private-response.guard",
    "common/api-exception.filter",
    "common/cks-product-contract",
    "modules/catalogue/product-media.service",
  ];
  const artifacts = [];
  for (const path of paths) {
    const sourceRelative = `apps/api/src/${path}.ts`;
    const builtRelative = `apps/api/dist/${path}.js`;
    const sourcePath = resolve(PINNED_BACKEND, sourceRelative);
    const builtPath = resolve(PINNED_BACKEND, builtRelative);
    const [source, built, sourceStat, builtStat] = await Promise.all([
      readFile(sourcePath),
      readFile(builtPath),
      stat(sourcePath),
      stat(builtPath),
    ]);
    const committed = execFileSync(
      "git",
      ["-C", PINNED_BACKEND, "show", `${PINNED_HEAD}:${sourceRelative}`],
      { windowsHide: true },
    );
    // Working-tree text has CRLF on Windows; Git stores LF.
    const normalize = (bytes) =>
      bytes.toString("utf8").replaceAll("\r\n", "\n");
    const sourceMatchesPinnedHead = normalize(source) === normalize(committed);
    const buildAtOrAfterSource = builtStat.mtimeMs >= sourceStat.mtimeMs;
    assert.ok(
      sourceMatchesPinnedHead,
      `${sourceRelative} differs from the pinned HEAD.`,
    );
    assert.ok(
      buildAtOrAfterSource,
      `${builtRelative} predates its pinned source.`,
    );
    artifacts.push({
      source: sourceRelative,
      built: builtRelative,
      sourceSha256: hash(source),
      builtSha256: hash(built),
      sourceModifiedAt: sourceStat.mtime.toISOString(),
      builtModifiedAt: builtStat.mtime.toISOString(),
      sourceMatchesPinnedHead,
      buildAtOrAfterSource,
    });
  }
  return {
    worktree: PINNED_BACKEND,
    head,
    artifacts,
    limitation:
      "Existing local dist is reused. Tracked source matches pinned HEAD and dist timestamps follow source; a fresh reproducible build was not performed or claimed.",
    persistenceBoundary:
      "Read-only synthetic repository interprets recorded real service predicates. PostgreSQL membership/persistence evidence is reused separately from the pinned serializer handoff; this run does not repeat it.",
  };
}

/**
 * Start only the unchanged pinned catalogue HTTP boundary on loopback.
 * Options: fixtures (parsed handoff), fixturePath, port, cookieName, cookieValue,
 * assignmentContextId. Ancillary customer startup routes belong to caller shim.
 */
export async function startPairedBackend(options = {}) {
  const fixturePath =
    options.fixturePath ??
    fileURLToPath(
      new URL("./handoff/serializer-fixtures.json", import.meta.url),
    );
  const fixtures =
    options.fixtures ?? JSON.parse(await readFile(fixturePath, "utf8"));
  const provenance = await buildProvenance();
  const backendRequire = createRequire(
    resolve(PINNED_BACKEND, "apps/api/package.json"),
  );
  backendRequire("reflect-metadata");
  const { Module, ValidationPipe } = backendRequire("@nestjs/common");
  const { NestFactory } = backendRequire("@nestjs/core");
  const load = (path) =>
    import(
      pathToFileURL(resolve(PINNED_BACKEND, `apps/api/dist/${path}.js`)).href
    );
  const [
    controller,
    serviceModule,
    identityModule,
    privateModule,
    filterModule,
    exceptionModule,
  ] = await Promise.all([
    load("modules/customer-catalogue/customer-catalogue.controller"),
    load("modules/customer-catalogue/customer-catalogue.service"),
    load("modules/checkout/savt-customer-identity.guard"),
    load("common/customer-private-response.guard"),
    load("common/api-exception.filter"),
    load("common/api-exception"),
  ]);
  const { CustomerCatalogueController } = controller;
  const { CustomerCatalogueService } = serviceModule;
  const { SavtCustomerIdentityGuard, SAVT_CUSTOMER_IDENTITY_ADAPTER } =
    identityModule;
  const { CustomerCataloguePrivateResponseGuard } = privateModule;
  const { ApiExceptionFilter } = filterModule;
  const { ApiException } = exceptionModule;

  const observations = { http: [], queries: [], service: [] };
  const outlet = fixtures.detail.meta.outlet;
  const outletId = outlet.id;
  const customerId = "10000000-0000-4000-8000-000000000001";
  const addressId = "10000000-0000-4000-8000-000000000002";
  const organisationId = "10000000-0000-4000-8000-000000000003";
  const assignmentContextId =
    options.assignmentContextId ?? Buffer.alloc(32, 5).toString("base64url");
  const cookieName = options.cookieName ?? "__Host-cksgo_session";
  const cookieValue = options.cookieValue ?? "align02-synthetic-session";
  const startTime = Date.now();
  const sessionExpiresAt = startTime + 60 * 60_000;
  const contextExpiresAt = startTime + 5 * 60_000;
  const session = {
    sessionHash: "a".repeat(64),
    bindingHash: "b".repeat(64),
    sessionGeneration: 1,
    sessionExpiresAt,
  };
  const stored = {
    ...session,
    organisationId,
    customerId,
    customerRowVersion: 1,
    customerAddressId: addressId,
    addressRowVersion: 1,
    outletId,
    algorithmVersion: "ROAD_DISTANCE_V1",
    resolvedAt: startTime,
    expiresAt: contextExpiresAt,
  };
  const categories = fixtures.categories.data.map((row, index) => ({
    ...row,
    status: "ACTIVE",
    sortOrder: index,
  }));
  const subcategories = fixtures.subcategories.data.map((row, index) => ({
    ...row,
    status: "ACTIVE",
    category: categories.find((category) => category.id === row.categoryId),
    sortOrder: index,
  }));
  const listingFromDetail = (detail) => {
    const data = detail.data;
    const category =
      categories.find((row) => row.id === data.category?.id) ?? null;
    const subcategory =
      subcategories.find((row) => row.id === data.subcategory?.id) ?? null;
    return {
      id: data.outletProductId,
      outletId,
      productId: data.productId,
      isActive: true,
      homeFeaturedOrder: data.category ? 1 : 2,
      sellingPriceMinor: BigInt(data.sellingPriceMinor),
      stockQuantity: data.availability === "AVAILABLE" ? 3 : 0,
      isPaused: false,
      product: {
        id: data.productId,
        status: "ACTIVE",
        productName: data.name,
        barcode: data.barcode,
        packSize: data.packSize,
        description: data.description,
        imageUrl: data.imageUrl,
        storageType: data.storageType,
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        uomId: data.uom ? "synthetic-uom" : null,
        category,
        subcategory,
        brand: data.brand ? { ...data.brand, status: "ACTIVE" } : null,
        uom: data.uom ? { ...data.uom, status: "ACTIVE" } : null,
      },
    };
  };
  const listings = [
    listingFromDetail(fixtures.detail),
    listingFromDetail(fixtures.legacyDetail),
  ];
  const client = {
    customerAddress: readOnlyTable(
      "customerAddress",
      [
        {
          id: addressId,
          customerId,
          status: "ACTIVE",
          rowVersion: 1,
          latitude: { toNumber: () => 5.98 },
          longitude: { toNumber: () => 116.08 },
        },
      ],
      observations.queries,
    ),
    outlet: readOnlyTable(
      "outlet",
      [
        {
          id: outletId,
          organisationId,
          outletCode: outlet.displayReference,
          name: outlet.displayName,
          masterStatus: "ACTIVE",
          cksGoStatus: "ONLINE",
        },
      ],
      observations.queries,
    ),
    category: readOnlyTable("category", categories, observations.queries),
    subcategory: readOnlyTable(
      "subcategory",
      subcategories,
      observations.queries,
    ),
    outletProduct: readOnlyTable(
      "outletProduct",
      listings,
      observations.queries,
    ),
    $transaction(operations, settings) {
      observations.queries.push({
        table: "$transaction",
        method: "read-only batch",
        arguments: { operationCount: operations.length, settings },
      });
      return Promise.all(operations);
    },
  };
  const customers = {
    resolveOrganisationId: async () => organisationId,
    findBySavtUserId: async (_organisationId, savtUserId) =>
      savtUserId === "align02-synthetic"
        ? { id: customerId, accountStatus: "ACTIVE", rowVersion: 1 }
        : null,
  };
  const contexts = {
    async read(handle, binding) {
      if (
        handle !== assignmentContextId ||
        binding.sessionHash !== session.sessionHash ||
        binding.bindingHash !== session.bindingHash ||
        binding.sessionGeneration !== session.sessionGeneration ||
        Date.now() >= contextExpiresAt
      )
        throw new ApiException(
          409,
          "CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED",
          "Synthetic assignment context is unavailable.",
        );
      return stored;
    },
  };
  const readiness = {
    evaluate: async () => ({ outletId, ready: true, canAcceptNewOrders: true }),
  };
  const service = new CustomerCatalogueService(
    { client },
    customers,
    contexts,
    readiness,
    { now: () => new Date() },
    [],
  );
  for (const method of [
    "listCategories",
    "listSubcategories",
    "listProducts",
    "getProduct",
  ]) {
    const original = service[method].bind(service);
    service[method] = async (...args) => {
      const observation = {
        method,
        outletId: args[2],
        input: serializable(args.slice(3)),
      };
      observations.service.push(observation);
      try {
        const result = await original(...args);
        observation.result = serializable(result);
        return result;
      } catch (error) {
        observation.error = error.getResponse?.() ?? { message: error.message };
        throw error;
      }
    };
  }
  const adapter = {
    async authenticate(request) {
      const cookies = (request.headers.cookie ?? "")
        .split(";")
        .map((part) => part.trim());
      if (
        !cookies.includes(`${cookieName}=${cookieValue}`) ||
        Date.now() >= sessionExpiresAt
      )
        throw new ApiException(
          401,
          "CUSTOMER_SESSION_INVALID",
          "Synthetic customer session is invalid.",
        );
      return { savtUserId: "align02-synthetic", customerSession: session };
    },
  };
  class PairedCatalogueModule {}
  Module({
    controllers: [CustomerCatalogueController],
    providers: [
      SavtCustomerIdentityGuard,
      CustomerCataloguePrivateResponseGuard,
      { provide: CustomerCatalogueService, useValue: service },
      { provide: SAVT_CUSTOMER_IDENTITY_ADAPTER, useValue: adapter },
    ],
  })(PairedCatalogueModule);
  const app = await NestFactory.create(PairedCatalogueModule, {
    logger: false,
    abortOnError: false,
    rawBody: true,
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use((request, response, next) => {
    const event = {
      method: request.method,
      path: request.originalUrl ?? request.url,
      headers: {
        productContract: request.headers["x-cks-product-contract"] ?? null,
        assignmentContextPresent: Boolean(
          request.headers["x-cks-assignment-context"],
        ),
        assignmentContextMatches:
          request.headers["x-cks-assignment-context"] === assignmentContextId,
        origin: request.headers.origin ?? null,
        cookieNames: (request.headers.cookie ?? "")
          .split(";")
          .map((part) => part.trim().split("=", 1)[0])
          .filter(Boolean),
      },
    };
    observations.http.push(event);
    response.once("finish", () => {
      event.status = response.statusCode;
      event.responseHeaders = {
        cacheControl: response.getHeader("cache-control") ?? null,
        vary: response.getHeader("vary") ?? null,
        contentType: response.getHeader("content-type") ?? null,
      };
    });
    next();
  });
  try {
    await app.listen(options.port ?? 0, "127.0.0.1");
  } catch (error) {
    await app.close();
    throw error;
  }
  const origin = await app.getUrl();
  return {
    origin,
    baseUrl: `${origin}/api/v1`,
    close: () => app.close(),
    fixtures,
    outletId,
    categoryId: fixtures.detail.data.category.id,
    subcategoryId: fixtures.detail.data.subcategory.id,
    outletProductId: fixtures.detail.data.outletProductId,
    legacyOutletProductId: fixtures.legacyDetail.data.outletProductId,
    customerId,
    addressId,
    addressRowVersion: 1,
    assignmentContextId,
    assignmentContextResolvedAt: new Date(startTime).toISOString(),
    assignmentContextExpiresAt: new Date(contextExpiresAt).toISOString(),
    sessionExpiresAt: new Date(sessionExpiresAt).toISOString(),
    asOf: () => new Date().toISOString(),
    cookieName,
    cookieValue,
    observations,
    provenance,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const backend = await startPairedBackend();
  console.log(
    JSON.stringify({
      status: "listening",
      origin: backend.origin,
      baseUrl: backend.baseUrl,
      outletId: backend.outletId,
      assignmentContextId: backend.assignmentContextId,
      cookieName: backend.cookieName,
      cookieValue: backend.cookieValue,
      boundary: backend.provenance.persistenceBoundary,
    }),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await backend.close();
    });
}
