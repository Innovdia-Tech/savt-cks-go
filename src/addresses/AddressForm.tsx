import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  type Address,
  type AddressInput,
  type FieldErrors,
  fieldLimits,
  validateAddressInput,
} from "./contracts";
import { useCustomer } from "../customer/context";
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
export function AddressForm({
  address,
  location,
  onDone,
  onCancel,
}: {
  address?: Address;
  location?: AddressLocationInput;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { controller, state, setDirty, guardNavigation } = useCustomer();
  const form = useRef<HTMLFormElement>(null);
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
    state.listPhase !== "ready";
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
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${Object.keys(invalid)[0]}"]`)
        ?.focus();
      return;
    }
    if (
      await controller.mutate(address ? "edit" : "create", address?.id, input)
    ) {
      setDirty(false);
      onDone();
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
      {!location && <h2 className="text-xl font-black">Delivery details</h2>}
      <p className="text-sm text-slate-600">
        Confirm the details below. Your delivery location is saved securely in
        the background.
      </p>
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
              ? "Save changes"
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
    </form>
  );
}
