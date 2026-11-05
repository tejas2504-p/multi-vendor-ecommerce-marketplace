import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MarketplaceRole, AuthUser, LoginCredentials, RegisterCredentials } from '../types';
import { authApi } from '../services/auth.api';

interface AppContextValue {
  activeRole: MarketplaceRole;
  setActiveRole: (role: MarketplaceRole) => void;
  appName: string;
  phase: string;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  register: (credentials: RegisterCredentials) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalTab: 'login' | 'register';
  setAuthModalTab: (tab: 'login' | 'register') => void;
  openAuthModal: (tab?: 'login' | 'register') => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<MarketplaceRole>('customer');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  const refreshUser = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const profile = await authApi.getMe();
      setUser(profile);
      if (profile?.role) {
        setActiveRole(profile.role);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: LoginCredentials): Promise<AuthUser> => {
    const loggedInUser = await authApi.login(credentials);
    setUser(loggedInUser);
    if (loggedInUser.role) {
      setActiveRole(loggedInUser.role);
    }
    setAuthModalOpen(false);
    return loggedInUser;
  };

  const register = async (credentials: RegisterCredentials): Promise<AuthUser> => {
    const newUser = await authApi.register(credentials);
    setUser(newUser);
    setActiveRole(newUser.role || 'customer');
    setAuthModalOpen(false);
    return newUser;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setActiveRole('customer');
    }
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <AppContext.Provider
      value={{
        activeRole,
        setActiveRole,
        appName: 'NexusMarket',
        phase: 'Phase 5B: Advanced Search & Indexing',
        user,
        isAuthenticated: Boolean(user),
        isLoadingAuth,
        login,
        register,
        logout,
        refreshUser,
        authModalOpen,
        setAuthModalOpen,
        authModalTab,
        setAuthModalTab,
        openAuthModal,
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
