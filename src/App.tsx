import React, { useState, useEffect } from 'react';
import { Customer, CKEY, ADMIN_KEY } from './types';
import { store, StoreState } from './services/store';
import { BrandMark } from './components/BrandMark';
import { SyncStatus } from './components/SyncStatus';
import { Toast } from './components/Toast';
import { Lightbox } from './components/Lightbox';
import { LoginView } from './components/LoginView';
import { CustomerNewView } from './components/CustomerNewView';
import { DailyReportView } from './components/DailyReportView';
import { HomeFeedView } from './components/HomeFeedView';
import { SpreadsheetView } from './components/SpreadsheetView';
import { AdminView } from './components/AdminView';

export const App: React.FC = () => {
  const [storeState, setStoreState] = useState<StoreState>(() => store.getState());
  const [currentCode, setCurrentCode] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(CKEY);
      if (saved && saved !== ADMIN_KEY) return saved;
    } catch (e) {}
    return null;
  });
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CKEY) === ADMIN_KEY;
    } catch (e) {}
    return false;
  });

  const [activeTab, setActiveTab] = useState<'moi' | 'bc' | 'home' | 'ds'>('moi');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(s => {
      setStoreState({ ...s });
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(curr => (curr === msg ? null : curr));
    }, 2800);
  };

  const handleLogin = (code: string) => {
    setCurrentCode(code);
    setIsAdminMode(false);
    try {
      localStorage.setItem(CKEY, code);
    } catch (e) {}
    setActiveTab('moi');
    setEditingCustomer(null);
    window.scrollTo(0, 0);
  };

  const handleEnterAdmin = () => {
    setIsAdminMode(true);
    setCurrentCode(null);
    try {
      localStorage.setItem(CKEY, ADMIN_KEY);
    } catch (e) {}
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    setCurrentCode(null);
    setIsAdminMode(false);
    setEditingCustomer(null);
    try {
      localStorage.removeItem(CKEY);
    } catch (e) {}
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setActiveTab('moi');
    window.scrollTo(0, 0);
  };

  // Not logged in
  if (!isAdminMode && !currentCode) {
    return (
      <>
        <LoginView
          codes={storeState.codes}
          onLogin={handleLogin}
          onEnterAdmin={handleEnterAdmin}
        />
        <Toast message={toastMsg} />
      </>
    );
  }

  // Admin View
  if (isAdminMode) {
    return (
      <>
        <AdminView
          codes={storeState.codes}
          customers={storeState.customers}
          reports={storeState.reports}
          sheet={storeState.sheet}
          onLogout={handleLogout}
          onToast={showToast}
          onZoomPhoto={setLightboxSrc}
        />
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        <Toast message={toastMsg} />
      </>
    );
  }

  // Staff View
  return (
    <div id="app" className={activeTab === 'ds' ? 'wide' : ''}>
      <header className="top">
        <div className="topin">
          <div className="row-sb">
            <BrandMark />
            <div className="me">
              <b>NV {currentCode}</b>
              <button type="button" className="linkbtn" onClick={handleLogout}>
                Đổi mã
              </button>
            </div>
          </div>
          <nav className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'moi'}
              onClick={() => {
                setActiveTab('moi');
                window.scrollTo(0, 0);
              }}
            >
              Khách mới
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bc'}
              onClick={() => {
                setActiveTab('bc');
                window.scrollTo(0, 0);
              }}
            >
              Báo cáo ngày
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'home'}
              onClick={() => {
                setActiveTab('home');
                window.scrollTo(0, 0);
              }}
            >
              Trang chủ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ds'}
              onClick={() => {
                setActiveTab('ds');
                window.scrollTo(0, 0);
              }}
            >
              Danh sách khách hàng
            </button>
          </nav>
        </div>
      </header>

      <main>
        <SyncStatus mode={storeState.mode} />

        {activeTab === 'moi' && (
          <CustomerNewView
            currentCode={currentCode!}
            customers={storeState.customers}
            editingCustomer={editingCustomer}
            onClearEditing={() => setEditingCustomer(null)}
            onToast={showToast}
            onZoomPhoto={setLightboxSrc}
          />
        )}

        {activeTab === 'bc' && (
          <DailyReportView
            currentCode={currentCode!}
            reports={storeState.reports}
            customers={storeState.customers}
            onToast={showToast}
          />
        )}

        {activeTab === 'home' && (
          <HomeFeedView
            currentCode={currentCode!}
            customers={storeState.customers}
            codes={storeState.codes}
            onEditCustomer={handleEditCustomer}
            onToast={showToast}
            onZoomPhoto={setLightboxSrc}
          />
        )}

        {activeTab === 'ds' && (
          <SpreadsheetView
            currentCode={currentCode}
            sheetData={storeState.sheet}
            onToast={showToast}
          />
        )}
      </main>

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      <Toast message={toastMsg} />
    </div>
  );
};

export default App;
