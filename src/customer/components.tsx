import { useState } from "react";
import { useCustomer } from "./context";
import { errorMessage } from "./errors";
import { AddressForm } from "../addresses/AddressForm";
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
      <h2 className="mt-2 break-words text-2xl font-black">
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
      <p className="font-black">
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
  onRetried?: () => void;
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
                  if (saved) onRetried?.();
                })
              }
            >
              Retry same request
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
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [discardReload, setDiscardReload] = useState(false);
  const blocked =
    state.readOnly ||
    state.busy ||
    state.canRetryOperation ||
    state.listPhase !== "ready" ||
    state.profilePhase !== "ready" ||
    state.error?.category === "conflict";
  const done = () => {
    setDirty(false);
    setEditing(null);
  };
  const reload = () => {
    done();
    setDiscardReload(false);
    void controller.load();
  };
  return (
    <div className="customer-surface space-y-4 px-5 py-4">
      <h1 className="text-2xl font-black">Profile &amp; addresses</h1>
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
      {editing ? (
        <AddressForm
          key={
            editing === "new" ? "new" : editing.id + ":" + editing.rowVersion
          }
          address={editing === "new" ? undefined : editing}
          onDone={done}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black">Saved addresses</h2>
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
          {state.listPhase === "ready" && state.addresses.length === 0 && (
            <p className="customer-card">
              No saved addresses yet. Add an address for your next delivery.
            </p>
          )}
          {(["ACTIVE", "INACTIVE"] as const).map((status) => (
            <section key={status} className="space-y-3">
              <h3 className="font-black">
                {status === "ACTIVE"
                  ? "Active addresses"
                  : "Inactive addresses"}{" "}
                ({state.addresses.filter((a) => a.status === status).length})
              </h3>
              {state.addresses
                .filter((a) => a.status === status)
                .map((address) => (
                  <article key={address.id} className="customer-card">
                    <AddressText address={address} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="customer-button"
                        aria-label={`Edit ${address.label}`}
                        disabled={blocked}
                        onClick={() => setEditing(address)}
                      >
                        Edit
                      </button>
                      {status === "ACTIVE" ? (
                        <>
                          <button
                            className="customer-button"
                            disabled={blocked || address.isDefault}
                            onClick={() =>
                              void controller.mutate("default", address.id)
                            }
                          >
                            Set default
                          </button>
                          <button
                            className="customer-button"
                            disabled={blocked}
                            onClick={() => setDeactivating(address.id)}
                          >
                            Deactivate
                          </button>
                        </>
                      ) : (
                        <button
                          className="customer-button"
                          disabled={blocked}
                          onClick={() =>
                            void controller.mutate("reactivate", address.id)
                          }
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                    {deactivating === address.id && (
                      <div className="mt-3 rounded-2xl bg-amber-50 p-3">
                        <p className="text-sm">
                          Deactivate {address.label}? It will no longer be
                          available at checkout. You can reactivate it later.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            className="customer-button"
                            disabled={blocked}
                            onClick={() => setDeactivating(null)}
                          >
                            Keep active
                          </button>
                          <button
                            className="customer-button"
                            disabled={blocked}
                            onClick={() => {
                              setDeactivating(null);
                              void controller.mutate("deactivate", address.id);
                            }}
                          >
                            Confirm deactivate
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
            </section>
          ))}
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
}: {
  onManage: () => void;
  catalogue?: boolean;
}) {
  const { state, controller } = useCustomer();
  const active = state.addresses.filter((a) => a.status === "ACTIVE");
  const selected = controller.selectedAddress();
  return (
    <section className="customer-surface customer-card space-y-3">
      <h2 className="font-black">Delivery address</h2>
      {state.listPhase === "loading" ? (
        <p role="status">Loading saved addresses…</p>
      ) : state.listPhase === "error" ? (
        <DataFeedback />
      ) : selected ? (
        <>
          <label htmlFor="checkout-address" className="block text-sm font-bold">
            Choose an active address
          </label>
          <select
            id="checkout-address"
            className="customer-input"
            value={selected.id}
            disabled={state.busy}
            onChange={(e) => controller.select(e.target.value)}
          >
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
          <AddressText address={selected} />
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
          ? "Your outlet is assigned automatically for the selected address."
          : "Address selection is for this prototype. Prices, delivery, payment and order confirmation remain mocked."}
      </p>
    </section>
  );
}
export function DeliveryAddressLink({ onManage }: { onManage: () => void }) {
  const { state, controller } = useCustomer();
  const a = controller.selectedAddress();
  return (
    <button
      className="mt-1 flex min-h-11 max-w-full items-center text-left text-[18px] font-black leading-6 text-slate-950"
      onClick={onManage}
    >
      <span className="truncate">
        {state.listPhase === "loading"
          ? "Loading delivery address…"
          : a
            ? `Deliver to ${a.label}`
            : "Profile & saved addresses"}
      </span>
    </button>
  );
}
