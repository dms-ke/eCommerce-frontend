"use client";

import { useCart } from "@/context/CartContext";

type Props = {
  product: {
    id: number;
    name: string;
    price: number;
    photoUrl?: string;    // 🔥 NEW: Pass image to cart
    condition?: string;   // 🔥 NEW: Pass condition to cart
    sellerName?: string;  // 🔥 NEW: Pass seller name to cart
  };
  quantity?: number; 
  className?: string; 
};

export default function AddToCartButton({ product, quantity = 1, className }: Props) {
  const { addToCart } = useCart();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();  // Prevents link navigation if the button is inside a <Link>
        e.stopPropagation(); // Prevents triggering clicks on parent elements
        
        // Pass the full product details (including image, condition, and seller) to Context
        addToCart({ ...product, quantity });
      }}
      className={
        className || 
        "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm shadow-sm active:scale-[0.98]"
      }
    >
      Add to Cart
    </button>
  );
}