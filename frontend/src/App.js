import React, { useState, createContext, useContext, useCallback } from 'react';
import './App.css';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

export const AppContext = createContext();

export const useApp = () => useContext(AppContext);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const login = useCallback((password) => {
    if (password === 'admin123') {
      setIsLoggedIn(true);
      return { success: true };
    }
    return { success: false, message: 'Password admin salah.' };
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  }, []);

  const contextValue = {
    isLoggedIn,
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    login,
    logout,
  };

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
