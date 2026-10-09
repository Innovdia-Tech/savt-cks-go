import { record, exact, uuid, date } from "../customer/contracts";
export type Availability = "AVAILABLE" | "UNAVAILABLE";
export type Outlet = {
  id: string;
  displayReference: string;
  displayName: string;
  status: "ACTIVE";
  operatingState: "ONLINE";
  availability: Availability;
};
export type Assignment = {
  assignmentContextId: string;
  customerAddressId: string;
  addressRowVersion: number;
  outlet: Outlet;
  resolvedAt: string;
  expiresAt: string;
};
export type Category = { id: string; name: string };
export type CustomerCategory = Category & { code: string };
export type CustomerSubcategory = CustomerCategory & { categoryId: string };
export type Product = {
  productId: string;
  outletProductId: string;
  name: string;
  imageUrl: string | null;
  barcode?: string | null;
  category: Category | null;
  subcategory: Category | null;
  brand: Category | null;
  uom: { code: string; name: string } | null;
  packSize: string | null;
  sellingPriceMinor: number;
  currency: "MYR";
  availability: Availability;
};
export type Detail = Product & {
  description: string | null;
  storageType: "AMBIENT" | "CHILLED" | "FROZEN" | null;
};
export type DetailMeta = {
  outlet: Outlet;
  assignmentContextExpiresAt: string;
  asOf: string;
};
export type PageMeta = DetailMeta & {
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};
export type Page<T> = { data: T[]; meta: PageMeta };
export type DetailEnvelope = { data: Detail; meta: DetailMeta };
const fail = (): never => {
  throw new Error("Invalid catalogue response.");
};
function obj(v: unknown, keys: string[]): Record<string, unknown> {
  if (!record(v) || !exact(v, keys)) return fail();
  return v;
}
const str = (v: unknown, max: number, empty = false): v is string =>
  typeof v === "string" && (empty || v.trim().length > 0) && v.length <= max;
const integer = (
  v: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const available = (v: unknown): v is Availability =>
  v === "AVAILABLE" || v === "UNAVAILABLE";
export const contextId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(v);
function outlet(v: unknown): Outlet {
  const d = obj(v, [
    "id",
    "displayReference",
    "displayName",
    "status",
    "operatingState",
    "availability",
  ]);
  if (
    !uuid(d.id) ||
    !str(d.displayReference, 40) ||
    !str(d.displayName, 160) ||
    d.status !== "ACTIVE" ||
    d.operatingState !== "ONLINE" ||
    !available(d.availability)
  )
    return fail();
  return { ...d } as Outlet;
}
function category(v: unknown): Category {
  const d = obj(v, ["id", "name"]);
  if (!uuid(d.id) || !str(d.name, 160)) return fail();
  return { id: d.id, name: d.name };
}
function customerCategory(v: unknown): CustomerCategory {
  const d = obj(v, ["id", "code", "name"]);
  if (
    !uuid(d.id) ||
    typeof d.code !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/.test(d.code) ||
    !str(d.name, 160)
  )
    return fail();
  return { id: d.id, code: d.code, name: d.name };
}
const managedProductImagePath =
  /^\/api\/v1\/product-media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

function imageUrl(v: unknown, productId: unknown): boolean {
  if (v === null) return true;
  if (!str(v, 1000) || !uuid(productId)) return false;
  const managed = managedProductImagePath.exec(v);
  if (managed) return managed[1] === productId.toLowerCase();
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" && !u.username && !u.password && !!u.hostname
    );
  } catch {
    return false;
  }
}
const productKeys = [
  "productId",
  "outletProductId",
  "name",
  "imageUrl",
  "category",
  "subcategory",
  "brand",
  "uom",
  "packSize",
  "sellingPriceMinor",
  "currency",
  "availability",
];
function product(v: unknown, detail = false): Product | Detail {
  const cks = record(v) && Object.hasOwn(v, "barcode");
  const keys = [...productKeys, ...(cks ? ["barcode"] : [])];
  const d = obj(v, detail ? [...keys, "description", "storageType"] : keys);
  const u = cks && d.uom === null ? null : obj(d.uom, ["code", "name"]);
  if (
    !uuid(d.productId) ||
    !uuid(d.outletProductId) ||
    !str(d.name, 200) ||
    !imageUrl(d.imageUrl, d.productId) ||
    (cks && !(d.barcode === null || str(d.barcode, 80))) ||
    (u !== null && (!str(u.code, 40) || !str(u.name, 120))) ||
    !(d.packSize === null || str(d.packSize, 120, true)) ||
    !integer(d.sellingPriceMinor, 0, 999999999999) ||
    d.currency !== "MYR" ||
    !available(d.availability)
  )
    return fail();
  if (
    detail &&
    (!(d.description === null || str(d.description, 4000, true)) ||
      (!(cks && d.storageType === null) &&
        !["AMBIENT", "CHILLED", "FROZEN"].includes(String(d.storageType))))
  )
    return fail();
  return {
    ...d,
    category: cks && d.category === null ? null : category(d.category),
    subcategory: d.subcategory === null ? null : category(d.subcategory),
    brand: d.brand === null ? null : category(d.brand),
    uom: u === null ? null : { ...u },
  } as Product | Detail;
}
function meta(v: unknown, pageSize?: number): DetailMeta | PageMeta {
  const d = obj(v, [
    "outlet",
    "assignmentContextExpiresAt",
    "asOf",
    ...(pageSize ? ["page", "pageSize", "total", "hasNextPage"] : []),
  ]);
  if (
    !date(d.asOf) ||
    !date(d.assignmentContextExpiresAt) ||
    Date.parse(d.assignmentContextExpiresAt) <= Date.parse(d.asOf)
  )
    return fail();
  if (
    pageSize &&
    (!integer(d.page, 1, 1000) ||
      !integer(d.pageSize, 1, pageSize) ||
      !integer(d.total, 0) ||
      typeof d.hasNextPage !== "boolean" ||
      d.hasNextPage !== (d.page < 1000 && d.page * d.pageSize < d.total))
  )
    return fail();
  return { ...d, outlet: outlet(d.outlet) } as DetailMeta | PageMeta;
}
export function parseAssignment(v: unknown): {
  data: Assignment;
  meta: { asOf: string };
} {
  const e = obj(v, ["data", "meta"]),
    m = obj(e.meta, ["asOf"]);
  const d = obj(e.data, [
    "assignmentContextId",
    "customerAddressId",
    "addressRowVersion",
    "outlet",
    "resolvedAt",
    "expiresAt",
  ]);
  if (
    !contextId(d.assignmentContextId) ||
    !uuid(d.customerAddressId) ||
    !integer(d.addressRowVersion, 1) ||
    !date(d.resolvedAt) ||
    !date(d.expiresAt) ||
    !date(m.asOf)
  )
    return fail();
  const ttl = Date.parse(d.expiresAt) - Date.parse(d.resolvedAt);
  if (
    ttl <= 0 ||
    ttl > 300000 ||
    Date.parse(m.asOf) < Date.parse(d.resolvedAt) ||
    Date.parse(m.asOf) >= Date.parse(d.expiresAt)
  )
    return fail();
  return {
    data: { ...d, outlet: outlet(d.outlet) } as Assignment,
    meta: { asOf: m.asOf },
  };
}
function page<T>(
  v: unknown,
  max: number,
  parse: (v: unknown) => T,
  id: (v: T) => string,
): Page<T> {
  const e = obj(v, ["data", "meta"]),
    m = meta(e.meta, max) as PageMeta;
  if (
    !Array.isArray(e.data) ||
    e.data.length > m.pageSize ||
    e.data.length !==
      Math.min(m.pageSize, Math.max(0, m.total - (m.page - 1) * m.pageSize))
  )
    return fail();
  const data = e.data.map(parse);
  if (new Set(data.map(id)).size !== data.length) return fail();
  return { data, meta: m };
}
export const parseCategories = (v: unknown): Page<CustomerCategory> =>
  page(v, 100, customerCategory, (d) => d.id);
export function parseSubcategories(
  v: unknown,
  categoryId: string,
): Page<CustomerSubcategory> {
  if (!uuid(categoryId)) return fail();
  return page(
    v,
    100,
    (value) => {
      const d = obj(value, ["id", "categoryId", "code", "name"]);
      if (d.categoryId !== categoryId) return fail();
      return {
        ...customerCategory({ id: d.id, code: d.code, name: d.name }),
        categoryId,
      };
    },
    (d) => d.id,
  );
}
export const parseProducts = (v: unknown): Page<Product> => {
  const result = page(
    v,
    50,
    (d) => product(d) as Product,
    (d) => d.outletProductId,
  );
  if (
    result.meta.outlet.availability === "UNAVAILABLE" &&
    result.data.some((p) => p.availability !== "UNAVAILABLE")
  )
    return fail();
  return result;
};
export function parseDetail(v: unknown): DetailEnvelope {
  const e = obj(v, ["data", "meta"]);
  const data = product(e.data, true) as Detail;
  const m = meta(e.meta) as DetailMeta;
  if (
    m.outlet.availability === "UNAVAILABLE" &&
    data.availability !== "UNAVAILABLE"
  )
    return fail();
  return { data, meta: m };
}
