import { useState } from "react";
import { ChevronRightIcon } from "../components/Icons";
import { useCustomer } from "./context";
import { errorMessage } from "./errors";
import { DeliveryLocationSetup } from "./DeliveryLocationSetup";
import { hasDeliveryCoordinates } from "./delivery-readiness";
import { AddressForm } from "../addresses/AddressForm";
import { editAddressName } from "../addresses/presentation";
import { useOptionalCheckout } from "../checkout/context";
import type { Address } from "../addresses/contracts";
export { CustomerDataProvider } from "./context";
export function ProfileSummary() {
  const { state } = useCustomer();
  const p = state.profile;
  if (state.profilePhase === "loading")
    return <p role="status">Loading your profile…</p>;
  if (!p) return <p role="status">Your profile could not be loaded.</p>;
  return (
    <section className="customer-card">
      <p className="text-xs font-bold uppercase tracking-widest text-green-800">
        Savt membership
      </p>
      <h2 className="mt-2 break-words text-xl font-bold">
        {p.nameSnapshot || "Savt member"}
      </h2>
      {p.phoneE164Snapshot && (
        <p className="mt-1 text-sm text-slate-600">
          Phone ending {p.phoneE164Snapshot.slice(-4)}
        </p>
      )}
      <p className="mt-3 font-bold">
        {p.membershipTier} · {p.savtMemberStatus}
      </p>
      <p className="text-sm text-slate-600">
        CKS Go account: {p.accountStatus.toLowerCase()}
      </p>
      {(p.savtSyncStatus === "STALE" || p.savtSyncStatus === "FAILED") && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          Your membership details may be out of date. We couldn’t refresh them
          from Savt.
          {p.savtSyncedAt &&
            ` Last synced ${new Date(p.savtSyncedAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} (Malaysia time).`}
        </p>
      )}
      {p.savtSyncStatus === "NEVER_SYNCED" && (
        <p className="mt-3 text-sm">
          Your membership details have not synced yet.
        </p>
      )}
    </section>
  );
}
function AddressText({ address }: { address: Address }) {
  return (
    <div className="min-w-0 break-words text-sm leading-6">
      <p className="font-semibold">
        {address.label}
        {address.isDefault ? " · Default" : ""}
      </p>
      <p>{address.recipientName}</p>
      <p>
        {address.addressLine1}
        {address.addressLine2 ? `, ${address.addressLine2}` : ""}
      </p>
      <p>
        {[address.postcode, address.city, address.state, "Malaysia"]
          .filter(Boolean)
          .join(", ")}
      </p>
      {address.recipientPhoneE164 && (
        <p>Phone ending {address.recipientPhoneE164.slice(-4)}</p>
      )}
      {address.deliveryInstructions && (
        <p className="mt-2 whitespace-pre-wrap text-slate-600">
          {address.deliveryInstructions}
        </p>
      )}
    </div>
  );
}
export function DataFeedback({
  onReload,
  onRetried,
}: {
  onReload?: () => void;
  onRetried?: (saved: Address) => void;
}) {
  const { state, controller } = useCustomer();
  return (
    <>
      <div role="status" className="text-sm text-green-900">
        {state.notice}
      </div>
      {state.error && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p>{errorMessage(state.error)}</p>
          {state.canRetryOperation ? (
            <button
              className="customer-button mt-3"
              disabled={state.busy}
              onClick={() =>
                void controller.retryOperation().then((saved) => {
                  if (saved) onRetried?.(saved);
                })
              }
            >
              Try again
            </button>
          ) : (
            <button
              className="customer-button mt-3"
              disabled={state.busy}
              onClick={onReload ?? (() => void controller.load())}
            >
              Reload current addresses
            </button>
          )}
        </div>
      )}
    </>
  );
}
export function CustomerProfileScreen() {
  const { state, controller, guardNavigation, setDirty, development } =
    useCustomer();
  const checkout = useOptionalCheckout();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [discardReload, setDiscardReload] = useState(false);
  const blocked =
    state.readOnly ||
    state.busy ||
    state.canRetryOperation ||
    state.listPhase !== "ready" ||
    state.profilePhase !== "ready" ||
    state.error?.category === "conflict" ||
    Boolean(checkout?.state.paymentFrozen);
  const selectedAddressId = controller.selectedAddress()?.id;
  const activeAddresses = state.addresses.filter(
    (address) => address.status === "ACTIVE",
  );
  const done = () => {
    setDirty(false);
    setEditing(null);
    setEditingLocation(false);
  };
  const reload = () => {
    done();
    setDiscardReload(false);
    void controller.load();
  };
  return (
    <div className="customer-surface space-y-4 px-5 py-4">
      <h1 className="text-xl font-bold">Profile &amp; addresses</h1>
      <ProfileSummary />
      {state.readOnly && (
        <p role="status" className="rounded-2xl bg-slate-100 p-4 text-sm">
          Your account is read-only. You can view saved addresses but cannot
          change them.
        </p>
      )}
      <DataFeedback
        onReload={() => (editing ? setDiscardReload(true) : reload())}
        onRetried={done}
      />
      {discardReload && (
        <section className="customer-card">
          <p>
            Reloading will discard this form and fetch the current saved
            addresses.
          </p>
          <button className="customer-button mt-3" onClick={reload}>
            Reload and discard edits
          </button>
          <button
            className="customer-button mt-3"
            onClick={() => setDiscardReload(false)}
          >
            Keep editing
          </button>
        </section>
      )}
      {editing === "new" ||
      (editing && (!hasDeliveryCoordinates(editing) || editingLocation)) ? (
        <DeliveryLocationSetup
          address={editing === "new" ? null : editing}
          initialMode={editingLocation ? "confirm" : "choose"}
          onDone={done}
          onCancel={() =>
            editingLocation ? setEditingLocation(false) : done()
          }
        />
      ) : editing ? (
        <AddressForm
          key={editing.id + ":" + editing.rowVersion}
          address={editing}
          onDone={done}
          onDeleted={done}
          onChangeLocation={() => setEditingLocation(true)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Saved addresses</h2>
            <button
              className="customer-button customer-primary"
              disabled={blocked}
              onClick={() => setEditing("new")}
            >
              Add address
            </button>
          </div>
          {state.listPhase === "loading" && (
            <p role="status">Loading saved addresses…</p>
          )}
          {state.listPhase === "ready" &&
            !state.addresses.some((address) => address.status === "ACTIVE") && (
              <p className="customer-card">
                No saved addresses yet. Add an address for your next delivery.
              </p>
            )}
          <section className="space-y-3">
            {activeAddresses.map((address) => (
              <article
                key={address.id}
                className={`customer-card ${selectedAddressId === address.id ? "customer-card--selected" : ""}`.trim()}
              >
                {selectedAddressId === address.id && (
                  <span className="customer-selected-address">
                    Selected for delivery
                  </span>
                )}
                <AddressText address={address} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="customer-button"
                    aria-label={editAddressName(address, activeAddresses)}
                    disabled={blocked}
                    onClick={() => setEditing(address)}
                  >
                    Edit
                  </button>
                  <button
                    className="customer-button"
                    disabled={blocked || address.isDefault}
                    onClick={() =>
                      void controller.mutate("default", address.id)
                    }
                  >
                    Set default
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
      {development && (
        <details className="customer-card">
          <summary className="cursor-pointer text-sm font-bold">
            Synthetic development scenarios
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {["empty", "default", "mixed", "stale", "failed", "readonly"].map(
              (s) => (
                <button
                  className="customer-button"
                  disabled={state.busy || state.canRetryOperation}
                  key={s}
                  onClick={() =>
                    guardNavigation(() => {
                      done();
                      development.reset(s);
                      void controller.load();
                    })
                  }
                >
                  {s}
                </button>
              ),
            )}
            {[
              "conflict",
              "offline",
              "retryable",
              "lostResponse",
              "expired",
              "csrf",
            ].map((s) => (
              <button
                className="customer-button"
                key={s}
                onClick={() => development.failNext(s)}
              >
                Next: {s}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs">
            Fixtures reset on page refresh. No real customer information is
            used.
          </p>
        </details>
      )}
    </div>
  );
}
export function CheckoutAddress({
  onManage,
  catalogue = false,
  selecting = false,
}: {
  onManage: () => void;
  catalogue?: boolean;
  onSelect?: (addressId: string) => void;
  selecting?: boolean;
}) {
  const { state, controller } = useCustomer();
  const active = state.addresses.filter((a) => a.status === "ACTIVE");
  const selected = controller.selectedAddress();
  return (
    <section className="customer-surface customer-card space-y-3">
      <h2 className="font-semibold">Deliver to</h2>
      {state.listPhase === "loading" ? (
        <p role="status">Loading saved addresses…</p>
      ) : state.listPhase === "error" ? (
        <DataFeedback />
      ) : selected ? (
        <>
          <button
            type="button"
            className="customer-button w-full text-left"
            disabled={state.busy || selecting}
            aria-busy={selecting || undefined}
            onClick={onManage}
          >
            Change
          </button>
          <AddressText address={selected} />
          {selecting && <p role="status">Checking delivery availability…</p>}
        </>
      ) : (
        <p>
          No active saved address. Add or reactivate an address to use it here.
        </p>
      )}
      {!catalogue && (
        <button className="customer-button" onClick={onManage}>
          {active.length
            ? "Manage saved addresses"
            : state.readOnly
              ? "View saved addresses"
              : "Add an address"}
        </button>
      )}
      <p className="text-xs text-slate-500">
        {catalogue
          ? "Delivery availability is checked automatically for this address."
          : "This address is used for delivery."}
      </p>
    </section>
  );
}
export function DeliveryAddressLink({
  onManage,
  embeddedHome = false,
}: {
  onManage: () => void;
  embeddedHome?: boolean;
}) {
  const { state, controller } = useCustomer();
  const a = controller.selectedAddress();
  return (
    <button
      type="button"
      className="delivery-address-link"
      onClick={onManage}
      aria-label="Change delivery address"
    >
      <span className="delivery-address-link__copy">
        <span className="delivery-address-link__label">Deliver to</span>
        <strong>
          {state.listPhase === "loading"
            ? "Loading delivery address…"
            : a
              ? `${a.label} · ${[a.addressLine1, a.city].filter(Boolean).join(", ")}`
              : "Add delivery address"}
        </strong>
      </span>
      {embeddedHome ? (
        <ChevronRightIcon className="delivery-address-link__chevron" />
      ) : (
        <span className="delivery-address-link__change">
          {a ? "Change" : "Add"}
        </span>
      )}
    </button>
  );
}
