import React, { useState, createContext, useContext, useCallback, useEffect } from 'react';
import './App.css';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import { login as apiLogin, logout as apiLogout, checkSession, getToken, clearToken } from './api/apiClient';

export const AppContext = createContext();

export const useApp = () => useContext(AppContext);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [checking, setChecking] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      checkSession()
        .then((data) => {
          setIsLoggedIn(true);
          if (data.user) setCurrentUser(data.user);
        })
        .catch(() => { clearToken(); })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const result = await apiLogin(username, password);
      if (result.success) {
        setIsLoggedIn(true);
        if (result.user) setCurrentUser(result.user);
      }
      return result;
    } catch (e) {
      return { success: false, message: e.response?.data?.detail || 'Gagal login.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch (e) { /* ignore */ }
    clearToken();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
  }, []);

  const contextValue = {
    isLoggedIn,
    currentUser,
    setCurrentUser,
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    login,
    logout,
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50">
        {!isLoggedIn ? <LoginPage /> : <Layout />}
        <Toaster position="top-right" richColors />
      </div>
    </AppContext.Provider>
  );
}

export default App;
