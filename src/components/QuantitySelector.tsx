import { MinusIcon, PlusIcon } from "./Icons";

type QuantitySelectorProps = {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  label?: string;
  minimum?: number;
  maximum?: number;
  disabled?: boolean;
  className?: string;
};

export function QuantitySelector({
  quantity,
  onIncrement,
  onDecrement,
  label = "Quantity",
  minimum = 1,
  maximum,
  disabled = false,
  className = "",
}: QuantitySelectorProps) {
  return (
    <div
      className={`ui-quantity ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || quantity <= minimum}
        onClick={onDecrement}
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span aria-live="polite">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || (maximum !== undefined && quantity >= maximum)}
        onClick={onIncrement}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
