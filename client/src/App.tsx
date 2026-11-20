import { AppProvider } from './context/AppContext';
import { CartProvider, useCart } from './context/CartContext';
import { MainLayout } from './layouts/MainLayout';
import { LandingPage } from './pages/LandingPage';
import { CartDrawer } from './components/cart/CartDrawer';
import { AddressManagementModal } from './components/address/AddressManagementModal';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { CustomerOrdersModal } from './components/orders/CustomerOrdersModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function AppContent() {
  const { isOrdersModalOpen, closeOrdersModal } = useCart();

  return (
    <ErrorBoundary fallbackTitle="NexusMarket Application Error">
      <MainLayout>
        <LandingPage />
      </MainLayout>
      <CartDrawer />
      <CheckoutModal />
      <AddressManagementModal />
      <CustomerOrdersModal isOpen={isOrdersModalOpen} onClose={closeOrdersModal} />
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <AppProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AppProvider>
  );
}

export default App;
