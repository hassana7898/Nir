import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import EntryPage from '../pages/EntryPage';
import ExitPage from '../pages/ExitPage';
import ReportsPage from '../pages/ReportsPage';
import LogPage from '../pages/LogPage';
import SettingsPage from '../pages/SettingsPage';
import InventoryPage from '../pages/InventoryPage';
import ProductionPage from '../pages/ProductionPage';
import InventoryAnalysisPage from '../pages/InventoryAnalysisPage';
import FarmersPage from '../pages/FarmersPage';
import ActiveBroodsPage from '../pages/ActiveBroodsPage';
import DashboardPage from '../pages/DashboardPage';
import GlobalSearchPage from '../pages/GlobalSearchPage';
import { getSyncQueue } from '../services/dbStore';

const MainLayout: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncItems, setSyncItems] = useState(0);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const checkSyncQueue = async () => {
            const queue = await getSyncQueue();
            setSyncItems(queue.length);
        };

        void checkSyncQueue();
        const interval = window.setInterval(() => void checkSyncQueue(), 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.clearInterval(interval);
        };
    }, []);

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <header className="h-14 bg-white border-b flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">داشبورد مدیریت</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        {syncItems > 0 && (
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                <span aria-hidden="true" className="inline-block animate-spin">↻</span>
                                <span>{syncItems} آیتم در صف همگام‌سازی</span>
                            </div>
                        )}
                        {isOnline ? (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                                <span aria-hidden="true">●</span>
                                <span>آنلاین (متصل به سرور داخلی)</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                                <span aria-hidden="true">○</span>
                                <span>آفلاین (داده‌ها ذخیره و بعداً ارسال می‌شوند)</span>
                            </div>
                        )}
                    </div>
                </header>
                <main className="flex-1 p-6 overflow-y-auto bg-slate-50 relative">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/entry" element={<EntryPage />} />
                        <Route path="/exit" element={<ExitPage />} />
                        <Route path="/farmers" element={<FarmersPage />} />
                        <Route path="/broods" element={<ActiveBroodsPage />} />
                        <Route path="/inventory" element={<InventoryPage />} />
                        <Route path="/inventory-analysis" element={<InventoryAnalysisPage />} />
                        <Route path="/production" element={<ProductionPage />} />
                        <Route path="/global-search" element={<GlobalSearchPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/log" element={<LogPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
