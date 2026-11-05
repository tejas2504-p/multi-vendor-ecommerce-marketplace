import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Cart } from '../types';
import { cartApi } from '../services/cart.api';
import { useApp } from './AppContext';

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  isLoading: boolean;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  isCheckoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
  isAddressModalOpen: boolean;
  openAddressModal: () => void;
  closeAddressModal: () => void;
  isOrdersModalOpen: boolean;
  openOrdersModal: () => void;
  closeOrdersModal: () => void;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useApp();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState<boolean>(false);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }
    try {
      setIsLoading(true);
      const data = await cartApi.getCart();
      setCart(data);
    } catch {
      // Cart might be empty or user not logged in
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (productId: string, quantity: number = 1): Promise<void> => {
    try {
      setIsLoading(true);
      const updated = await cartApi.addToCart(productId, quantity);
      setCart(updated);
      setIsCartOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (productId: string, quantity: number): Promise<void> => {
    try {
      setIsLoading(true);
      const updated = await cartApi.updateQuantity(productId, quantity);
      setCart(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (productId: string): Promise<void> => {
    try {
      setIsLoading(true);
      const updated = await cartApi.removeItem(productId);
      setCart(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const updated = await cartApi.clearCart();
      setCart(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        isLoading,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        isCheckoutOpen,
        openCheckout: () => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        },
        closeCheckout: () => setIsCheckoutOpen(false),
        isAddressModalOpen,
        openAddressModal: () => setIsAddressModalOpen(true),
        closeAddressModal: () => setIsAddressModalOpen(false),
        isOrdersModalOpen,
        openOrdersModal: () => setIsOrdersModalOpen(true),
        closeOrdersModal: () => setIsOrdersModalOpen(false),
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

