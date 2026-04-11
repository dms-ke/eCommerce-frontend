"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// Define what a single item in our cart looks like
type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  photoUrl?: string; 
  condition?: string;  
  sellerName?: string; 
  description?: string; // 🔥 NEW: Track product description
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: { id: number; name: string; price: number; quantity?: number; photoUrl?: string; condition?: string; sellerName?: string; description?: string; }) => void;
  removeFromCart: (id: number) => void; 
  updateQuantity: (id: number, quantity: number) => void; 
  clearCart: () => void; 
  cartCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: { id: number; name: string; price: number; quantity?: number; photoUrl?: string; condition?: string; sellerName?: string; description?: string; }) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      const quantityToAdd = product.quantity || 1;
      
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantityToAdd } : item
        );
      }
      
      return [...prevCart, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: quantityToAdd,
        photoUrl: product.photoUrl,
        condition: product.condition, 
        sellerName: product.sellerName, 
        description: product.description // 🔥 NEW: Save description
      }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    setCart((prevCart) => 
      prevCart.map(item => 
        item.id === id ? { ...item, quantity: quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}