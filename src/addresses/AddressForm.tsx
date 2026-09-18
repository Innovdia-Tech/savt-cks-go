import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  type Address,
  type AddressInput,
  type FieldErrors,
  fieldLimits,
  validateAddressInput,
} from "./contracts";
import { useCustomer } from "../customer/context";
const labels = {
  label: "Address label",
  recipientName: "Recipient name",
  recipientPhoneE164: "Recipient phone (optional)",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2 (optional)",
  city: "City",
  state: "State",
  postcode: "Postcode (optional)",
  deliveryInstructions: "Delivery instructions (optional)",
  latitude: "Latitude (optional)",
  longitude: "Longitude (optional)",
};
export function AddressForm({
  address,
  onDone,
}: {
  address?: Address;
  onDone: () => void;
}) {
  const { controller, state, setDirty, guardNavigation } = useCustomer();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.keys(labels).map((k) => [
        k,
        String(address?.[k as keyof Address] ?? ""),
      ]),
    ),
  );
  const [isDefault, setDefault] = useState(false);
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
      latitude: values.latitude.trim() ? Number(values.latitude) : null,
      longitude: values.longitude.trim() ? Number(values.longitude) : null,
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
      <h2 className="text-xl font-black">
        {address ? "Edit address" : "Add address"}
      </h2>
      <p className="text-sm text-slate-600">
        Malaysia only. Optional fields may be left blank.
      </p>
      {Object.entries(labels).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`address-${key}`} className="block text-sm font-bold">
            {label}
          </label>
          {key === "deliveryInstructions" ? (
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
              inputMode={
                key === "latitude" || key === "longitude"
                  ? "decimal"
                  : undefined
              }
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
          {state.busy ? "Saving…" : "Save address"}
        </button>
        <button
          className="customer-button"
          disabled={state.busy || state.canRetryOperation}
          type="button"
          onClick={() => guardNavigation(onDone)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
