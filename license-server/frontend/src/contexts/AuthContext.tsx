import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { AdminSession, CustomerSession } from '../types';

interface AuthContextType {
  // Admin auth
  adminSession: AdminSession | null;
  isAdminAuthenticated: boolean;
  adminLogin: (adminKey: string) => Promise<void>;
  adminLogout: () => Promise<void>;

  // Customer auth
  customerSession: CustomerSession | null;
  isCustomerAuthenticated: boolean;
  customerLogin: (licenseKey: string) => Promise<void>;
  customerLogout: () => Promise<void>;

  // Loading states
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing sessions on mount
  useEffect(() => {
    checkExistingAuth();
  }, []);

  async function checkExistingAuth() {
    setIsLoading(true);
    try {
      // Check for customer token in localStorage
      const hasCustomerToken = apiClient.loadCustomerToken();

      // Only check customer session if we have a token
      if (hasCustomerToken) {
        try {
          const session = await apiClient.getCustomerSession();
          setCustomerSession(session);
        } catch (error) {
          // Invalid/expired customer token
          apiClient.clearAuth();
          setCustomerSession(null);
        }
      }

      // Only check admin session if we're on an admin route
      if (window.location.pathname.startsWith('/admin')) {
        try {
          const session = await apiClient.getAdminSession();
          setAdminSession(session);
        } catch (error) {
          // No valid admin session
          setAdminSession(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // ===== ADMIN AUTH =====

  async function adminLogin(adminKey: string) {
    try {
      const session = await apiClient.adminLogin(adminKey);
      setAdminSession(session);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async function adminLogout() {
    try {
      await apiClient.adminLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setAdminSession(null);
    }
  }

  // ===== CUSTOMER AUTH =====

  async function customerLogin(licenseKey: string) {
    try {
      const session = await apiClient.customerLogin(licenseKey);
      setCustomerSession(session);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async function customerLogout() {
    try {
      await apiClient.customerLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setCustomerSession(null);
    }
  }

  const value: AuthContextType = {
    adminSession,
    isAdminAuthenticated: !!adminSession,
    adminLogin,
    adminLogout,

    customerSession,
    isCustomerAuthenticated: !!customerSession,
    customerLogin,
    customerLogout,

    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
