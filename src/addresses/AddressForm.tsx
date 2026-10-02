import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  type Address,
  type AddressInput,
  type FieldErrors,
  fieldLimits,
  validateAddressInput,
} from "./contracts";
import { useCustomer } from "../customer/context";
import { useOptionalCheckout } from "../checkout/context";
import { hasDeliveryCoordinates } from "../customer/delivery-readiness";
export const addressFormFields = {
  addressLine2: "Unit / Floor / Lot No. (optional)",
  addressLine1: "Building / Residence / Street",
  city: "City",
  state: "State",
  postcode: "Postcode (optional)",
  deliveryInstructions: "Landmark / delivery instructions (optional)",
  label: "Save as",
  recipientName: "Recipient",
  recipientPhoneE164: "Phone (optional)",
};

export type AddressLocationInput = {
  latitude: number;
  longitude: number;
  addressLine1?: string;
  city?: string;
  state?: string;
  postcode?: string;
};
type LocationFields = Pick<
  AddressInput,
  "latitude" | "longitude" | "addressLine1" | "city" | "state" | "postcode"
>;
export function shouldSaveLocationAsNewAddress(
  address: Pick<Address, "id" | keyof LocationFields>,
  input: LocationFields,
  selectedId: string | null,
  hasCart: boolean,
) {
  return (
    hasCart &&
    selectedId === address.id &&
    (
      [
        "latitude",
        "longitude",
        "addressLine1",
        "city",
        "state",
        "postcode",
      ] as const
    ).some((key) =>
      key === "postcode"
        ? (address[key] || null) !== (input[key] || null)
        : (address[key] ?? null) !== (input[key] ?? null),
    )
  );
}
export function AddressForm({
  address,
  location,
  onDone,
  onCancel,
  onChangeLocation,
  onDeleted,
}: {
  address?: Address;
  location?: AddressLocationInput;
  onDone: (saved?: Address) => void;
  onCancel?: () => void;
  onChangeLocation?: () => void;
  onDeleted?: () => void;
}) {
  const { controller, state, setDirty, guardNavigation } = useCustomer();
  const checkout = useOptionalCheckout();
  const form = useRef<HTMLFormElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [awaitingDeleteFallback, setAwaitingDeleteFallback] = useState<
    string | null
  >(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const profile = state.profile;
    const suggested: Record<string, string> = {
      label: String(address?.label ?? "Home"),
      recipientName: String(
        address?.recipientName ?? profile?.nameSnapshot ?? "",
      ),
      recipientPhoneE164: String(
        address?.recipientPhoneE164 ?? profile?.phoneE164Snapshot ?? "",
      ),
      addressLine1: String(
        location?.addressLine1 ?? address?.addressLine1 ?? "",
      ),
      addressLine2: String(address?.addressLine2 ?? ""),
      city: String(location?.city ?? address?.city ?? ""),
      state: String(location?.state ?? address?.state ?? ""),
      postcode: String(location?.postcode ?? address?.postcode ?? ""),
      deliveryInstructions: String(address?.deliveryInstructions ?? ""),
    };
    return suggested;
  });
  const [isDefault, setDefault] = useState(
    () =>
      !address &&
      !state.addresses.some((candidate) => candidate.status === "ACTIVE"),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => setDirty(false);
  }, []);
  const blocked =
    state.busy ||
    state.canRetryOperation ||
    state.readOnly ||
    state.error?.category === "conflict" ||
    state.listPhase !== "ready" ||
    Boolean(checkout?.state.paymentFrozen);
  useEffect(() => {
    if (confirmingDelete && !deleteDialog.current?.open)
      deleteDialog.current?.showModal();
    if (!confirmingDelete && deleteDialog.current?.open)
      deleteDialog.current.close();
  }, [confirmingDelete]);
  useEffect(() => {
    if (
      !awaitingDeleteFallback ||
      !address ||
      !checkout ||
      checkout.state.transitionPhase !== "idle"
    )
      return;
    setAwaitingDeleteFallback(null);
    if (state.selectedId !== awaitingDeleteFallback) return;
    void controller.mutate("deactivate", address.id).then((saved) => {
      if (saved) (onDeleted ?? onDone)();
    });
  }, [
    awaitingDeleteFallback,
    address,
    checkout,
    checkout?.state.transitionPhase,
    state.selectedId,
    controller,
    onDeleted,
    onDone,
  ]);
  const cancelDelete = () => {
    setConfirmingDelete(false);
    requestAnimationFrame(() => deleteTrigger.current?.focus());
  };
  const confirmDelete = async () => {
    if (!address || blocked) return;
    setConfirmingDelete(false);
    const selected = state.selectedId === address.id;
    if (selected && checkout) {
      const fallback =
        state.addresses.find(
          (candidate) =>
            candidate.status === "ACTIVE" &&
            candidate.id !== address.id &&
            candidate.isDefault,
        ) ??
        state.addresses.find(
          (candidate) =>
            candidate.status === "ACTIVE" && candidate.id !== address.id,
        );
      if (fallback) {
        if (!hasDeliveryCoordinates(fallback)) {
          controller.select(fallback.id);
          const saved = await controller.mutate("deactivate", address.id);
          if (!saved) {
            controller.select(address.id);
            return;
          }
          checkout.controller.bindSelectedAddress(fallback);
          (onDeleted ?? onDone)();
          return;
        }
        const outcome = await checkout.selectAddress(fallback.id);
        if (outcome === "confirmation") {
          setAwaitingDeleteFallback(fallback.id);
          return;
        }
        if (outcome !== "committed") return;
      }
    }
    const saved = await controller.mutate("deactivate", address.id);
    if (!saved) return;
    if (selected && !controller.selectedAddress()) {
      checkout?.controller.clear();
      checkout?.controller.bindSelectedAddress(undefined);
    }
    (onDeleted ?? onDone)();
  };
  const fixedLocation = Boolean(
    location || (address?.latitude != null && address?.longitude != null),
  );
  const saveAsNew = Boolean(
    address &&
    shouldSaveLocationAsNewAddress(
      address,
      {
        latitude: location?.latitude ?? address.latitude,
        longitude: location?.longitude ?? address.longitude,
        addressLine1: values.addressLine1,
        city: values.city,
        state: values.state,
        postcode: values.postcode,
      },
      state.selectedId,
      Boolean(checkout?.state.lines.length),
    ),
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (blocked) return;
    const input = {
      ...values,
      countryCode: "MY",
      latitude: location?.latitude ?? address?.latitude ?? null,
      longitude: location?.longitude ?? address?.longitude ?? null,
      ...(!address ? { isDefault } : {}),
    } as AddressInput;
    const invalid = validateAddressInput(input);
    const incompletePin =
      fixedLocation &&
      ["addressLine1", "city", "state"].some((key) => invalid[key]);
    setErrors(
      incompletePin
        ? {
            ...invalid,
            form: "We couldn't confirm a complete street and area for this pin. Change location and try again.",
          }
        : invalid,
    );
    if (Object.keys(invalid).length) {
      if (incompletePin) return;
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${Object.keys(invalid)[0]}"]`)
        ?.focus();
      return;
    }
    const saved = await controller.mutate(
      saveAsNew || !address ? "create" : "edit",
      saveAsNew ? undefined : address?.id,
      saveAsNew ? { ...input, isDefault: false } : input,
    );
    if (saved) {
      setDirty(false);
      onDone(saved);
    }
  }
  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => void save(event)}
      className="customer-card space-y-4"
      aria-busy={state.busy}
    >
      {!location && (
        <h2 className="text-base font-semibold">Delivery details</h2>
      )}
      <p className="text-sm text-slate-600">
        Confirm the details below. Your delivery location is saved securely in
        the background.
      </p>
      {fixedLocation && (
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
          <p>The street and area below follow your confirmed map pin.</p>
          {onChangeLocation && (
            <button
              type="button"
              className="customer-button mt-2"
              disabled={blocked}
              onClick={() => guardNavigation(onChangeLocation)}
            >
              Change delivery location
            </button>
          )}
        </div>
      )}
      {saveAsNew && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950">
          Because your cart is using your current delivery address, this
          location will be saved as a new address. Your current delivery address
          and cart will stay unchanged unless you choose to switch.
        </p>
      )}
      {errors.form && (
        <p
          role="alert"
          className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950"
        >
          {errors.form}
        </p>
      )}
      {Object.entries(addressFormFields).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`address-${key}`} className="block text-sm font-bold">
            {label}
          </label>
          {key === "label" ? (
            <div
              className="address-save-as"
              id="address-label"
              role="group"
              aria-label="Save address as"
            >
              {Array.from(
                new Set([
                  "Home",
                  "Work",
                  "Other",
                  ...(values.label ? [values.label] : []),
                ]),
              ).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={blocked}
                  aria-pressed={values.label === option}
                  onClick={() => {
                    setValues({ ...values, label: option });
                    setErrors({ ...errors, label: "" });
                    setDirty(true);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : key === "deliveryInstructions" ? (
            <textarea
              id={`address-${key}`}
              name={key}
              className="customer-input resize-none"
              rows={3}
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `error-${key}` : undefined}
              maxLength={500}
              disabled={blocked}
              value={values[key]}
              onChange={(e) => {
                setValues({ ...values, [key]: e.target.value });
                setDirty(true);
              }}
            />
          ) : (
            <input
              id={`address-${key}`}
              name={key}
              className="customer-input"
              type={key === "recipientPhoneE164" ? "tel" : "text"}
              inputMode={key === "recipientPhoneE164" ? "tel" : undefined}
              maxLength={fieldLimits[key as keyof typeof fieldLimits]}
              disabled={blocked}
              readOnly={
                fixedLocation &&
                ["addressLine1", "city", "state", "postcode"].includes(key)
              }
              value={values[key]}
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `error-${key}` : undefined}
              onChange={(e) => {
                setValues({ ...values, [key]: e.target.value });
                setErrors({ ...errors, [key]: "" });
                setDirty(true);
              }}
            />
          )}
          {errors[key] && (
            <p id={`error-${key}`} className="mt-1 text-sm text-red-800">
              {errors[key]}
            </p>
          )}
        </div>
      ))}
      {!address && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={isDefault}
            disabled={blocked}
            onChange={(e) => {
              setDefault(e.target.checked);
              setDirty(true);
            }}
          />
          Set as default address
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="customer-button customer-primary"
          disabled={blocked}
          type="submit"
        >
          {state.busy
            ? "Saving…"
            : address
              ? saveAsNew
                ? "Save as new address"
                : "Save changes"
              : "Save & use this address"}
        </button>
        <button
          className="customer-button"
          disabled={state.busy || state.canRetryOperation}
          type="button"
          onClick={() => guardNavigation(onCancel ?? onDone)}
        >
          {onCancel ? "Back to location" : "Cancel"}
        </button>
      </div>
      {address?.status === "ACTIVE" && (
        <div className="border-t border-slate-200 pt-5">
          <button
            ref={deleteTrigger}
            type="button"
            className="customer-button customer-danger"
            disabled={blocked}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete address
          </button>
        </div>
      )}
      {confirmingDelete && (
        <dialog
          ref={deleteDialog}
          className="customer-dialog rounded-3xl p-6"
          aria-labelledby="delete-address-title"
          aria-describedby="delete-address-description"
          onCancel={(event) => {
            event.preventDefault();
            cancelDelete();
          }}
        >
          <h2 id="delete-address-title" className="text-base font-semibold">
            Delete this address?
          </h2>
          <p id="delete-address-description" className="my-4">
            This address will be removed from your saved addresses. Existing
            orders will not be affected.
          </p>
          {state.selectedId === address?.id && checkout?.state.lines.length ? (
            <p className="mb-4 text-sm">
              We’ll ask before clearing your cart to switch delivery areas. An
              address without a confirmed location keeps your cart but pauses
              checkout until you set its location. If no active address remains,
              deleting this address clears the cart.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              autoFocus
              type="button"
              className="customer-button"
              onClick={cancelDelete}
            >
              Keep address
            </button>
            <button
              type="button"
              className="customer-button customer-danger"
              disabled={blocked}
              onClick={() => void confirmDelete()}
            >
              Delete address
            </button>
          </div>
        </dialog>
      )}
    </form>
  );
}
