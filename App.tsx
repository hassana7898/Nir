import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { migrateLegacyData } from './services/dataService';
import { hydrateFromServer, initDataStore, triggerSync } from './services/dbStore';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import MainLayout from './components/MainLayout';
import ConnectionStatus from './components/ConnectionStatus';

const AppContent: React.FC = () => {
  const { isAuthenticated, isPasswordSet, loading } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const bootstrap = async () => {
      await initDataStore();
      await triggerSync();
      if (active) await hydrateFromServer();
    };
    void bootstrap();
    return () => { active = false; };
  }, [isAuthenticated]);

  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center bg-slate-100"><p>در حال بارگذاری...</p></div>;
  }

  return (
    <>
      <Routes>
        {!isPasswordSet ? <Route path="*" element={<SetupPage />} /> : !isAuthenticated ? <Route path="*" element={<LoginPage />} /> : <Route path="/*" element={<MainLayout />} />}
      </Routes>
      {isAuthenticated && <ConnectionStatus />}
    </>
  );
};

const App: React.FC = () => {
  const [ready, setReady] = React.useState(false);
  useEffect(() => { void migrateLegacyData().then(() => setReady(true)); }, []);
  if (!ready) return <div className="flex h-screen w-full items-center justify-center bg-slate-100"><p>در حال آماده سازی پایگاه داده...</p></div>;
  return <SettingsProvider><AuthProvider><AppContent /></AuthProvider></SettingsProvider>;
};

export default App;
