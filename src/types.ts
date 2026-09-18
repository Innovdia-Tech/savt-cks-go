export type Screen =
  "home" | "listing" | "detail" | "cart" | "checkout" | "tracking" | "profile";

export type Product = {
  id: string;
  name: string;
  unit: string;
  category: string;
  price: number;
  memberPrice: number;
  originalPrice: number;
  points: number;
  cashback: number;
  description: string;
  color: string;
  imageLabel: string;
  imageUrl?: string;
  badge?: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type CartTotals = {
  subtotal: number;
  discount: number;
  delivery: number;
  cashback: number;
  points: number;
  total: number;
};
