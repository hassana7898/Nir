import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  isPasswordSet: boolean;
  loading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setupPassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    const [setup, authenticated] = await Promise.all([authService.isPasswordSet(), authService.isAuthenticated()]);
    setIsPasswordSet(setup);
    setIsAuthenticated(authenticated);
    setLoading(false);
  }, []);

  useEffect(() => { void checkStatus(); }, [checkStatus]);

  const login = async (password: string) => {
    const ok = await authService.verifyPassword(password);
    setIsAuthenticated(ok);
    if (ok) setIsPasswordSet(true);
    return ok;
  };

  const logout = async () => { await authService.logout(); setIsAuthenticated(false); };

  const setupPassword = async (password: string) => {
    await authService.setPassword(password);
    await checkStatus();
  };

  return <AuthContext.Provider value={{ isAuthenticated, isPasswordSet, loading, login, logout, setupPassword }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
