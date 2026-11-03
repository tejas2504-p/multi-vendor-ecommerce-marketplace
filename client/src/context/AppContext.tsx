import React, { createContext, useContext, useState } from 'react';
import { MarketplaceRole } from '../types';

interface AppContextValue {
  activeRole: MarketplaceRole;
  setActiveRole: (role: MarketplaceRole) => void;
  appName: string;
  phase: string;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<MarketplaceRole>('customer');

  return (
    <AppContext.Provider
      value={{
        activeRole,
        setActiveRole,
        appName: 'NexusMarket',
        phase: 'Phase 1B: Foundation Setup',
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

