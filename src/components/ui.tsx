import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ChangeEventHandler,
  type FormEventHandler,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import type { CustomerOrderStage } from "../orders/contracts";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "tertiary";
  busy?: boolean;
  busyLabel?: string;
};

export function Button({
  variant = "primary",
  busy = false,
  busyLabel = "Please wait",
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && <span className="ui-spinner" aria-hidden="true" />}
      {busy ? <span className="sr-only">{children}</span> : children}
      {busy && <span aria-hidden="true">{busyLabel}</span>}
    </button>
  );
}

export function IconButton({
  label,
  className = "",
  children,
  onClick,
  ...props
}: Omit<ButtonProps, "aria-label"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`ui-icon-button ${className}`.trim()}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

type SupportedStatus = "AVAILABLE" | "UNAVAILABLE" | CustomerOrderStage;

const statusPresentations: Record<
  SupportedStatus,
  {
    label: string;
    tone: "positive" | "neutral" | "info" | "warning" | "negative";
  }
> = {
  AVAILABLE: { label: "Available", tone: "positive" },
  UNAVAILABLE: { label: "Unavailable", tone: "neutral" },
  ORDER_RECEIVED: { label: "Order received", tone: "info" },
  PICK_AND_PACK: { label: "Picking and packing", tone: "warning" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "positive" },
  CANCELLED: { label: "Cancelled", tone: "negative" },
  REJECTED: { label: "Not fulfilled", tone: "negative" },
};

export function StatusBadge({ status }: { status: SupportedStatus }) {
  const presentation = statusPresentations[status];
  return (
    <span className={`ui-status ui-status--${presentation.tone}`}>
      {presentation.label}
    </span>
  );
}

type SearchFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type" | "value" | "onChange"
> & {
  id: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClear: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  submitLabel?: string;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(
    {
      id,
      label,
      value,
      onChange,
      onClear,
      onSubmit,
      submitLabel = "Search",
      className = "",
      ...props
    },
    ref,
  ) {
    const field = (
      <>
        <label htmlFor={id}>{label}</label>
        <div className="ui-search-field__control">
          <input
            {...props}
            id={id}
            ref={ref}
            type="search"
            value={value}
            onChange={onChange}
          />
          {value && (
            <IconButton label="Clear search" onClick={onClear}>
              ×
            </IconButton>
          )}
          {onSubmit && (
            <Button type="submit" variant="secondary">
              {submitLabel}
            </Button>
          )}
        </div>
      </>
    );

    if (onSubmit) {
      return (
        <form
          noValidate
          className={`ui-search-field ${className}`.trim()}
          onSubmit={onSubmit}
        >
          {field}
        </form>
      );
    }
    return <div className={`ui-search-field ${className}`.trim()}>{field}</div>;
  },
);

export function SystemState({
  tone,
  title,
  description,
  actionLabel,
  onAction,
  busy = false,
}: {
  tone: "loading" | "empty" | "error";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}) {
  return (
    <section
      className={`ui-system-state ui-system-state--${tone}`}
      role="status"
      aria-live="polite"
      aria-busy={busy || undefined}
    >
      <span className="ui-system-state__mark" aria-hidden="true">
        {tone === "loading" ? (
          <span className="ui-spinner" />
        ) : tone === "error" ? (
          "!"
        ) : (
          "—"
        )}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction && !busy && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </section>
  );
}

export function Skeleton({
  label = "Loading",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={`ui-skeleton ${className}`.trim()} role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function syncDialog(element: HTMLDialogElement, open: boolean) {
  if (open && !element.open) {
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }
  if (!open && element.open) element.close();
}

export function BottomSheet({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    syncDialog(element, open);
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      className="ui-bottom-sheet"
      aria-labelledby="bottom-sheet-title"
      aria-describedby={description ? "bottom-sheet-description" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="ui-bottom-sheet__panel">
        <span className="ui-bottom-sheet__handle" aria-hidden="true" />
        <header>
          <div>
            <h2 id="bottom-sheet-title">{title}</h2>
            {description && <p id="bottom-sheet-description">{description}</p>}
          </div>
          <IconButton label="Close sheet" onClick={onClose}>
            ×
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}
