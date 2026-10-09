export function ItemBarcode({ barcode }: { barcode?: string | null }) {
  return barcode == null ? null : (
    <span className="item-barcode">Barcode {barcode}</span>
  );
}
