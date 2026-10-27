import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import OrganizationsView from './components/OrganizationsView';
import UsersView from './components/UsersView';
import SupplyChainRulesView from './components/SupplyChainRulesView';
import { api, getAuthToken, getStoredUser } from './services/api';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getAuthToken());
  const [activeTab, setActiveTab] = useState('dashboard');

  // Subsystem & Data State
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [batches, setBatches] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(false);

  // Toast System
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Load Health
  const loadHealth = useCallback(async () => {
    try {
      const res = await api.getHealth();
      setHealth(res);
    } catch (err) {
      console.warn('Health check warning:', err.message);
    }
  }, []);

  // Load All Authority Data
  const loadPortalData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [sumRes, batchRes, orgRes, userRes, ruleRes] = await Promise.allSettled([
        api.getBatchSummary(),
        api.getBatches(),
        api.getOrganizations(),
        api.getUsers(),
        api.getSupplyChainRules(),
      ]);

      if (sumRes.status === 'fulfilled') setMetrics(sumRes.value.metrics);
      if (batchRes.status === 'fulfilled') setBatches(batchRes.value.batches || []);
      if (orgRes.status === 'fulfilled') setOrganizations(orgRes.value.organizations || []);
      if (userRes.status === 'fulfilled') setUsers(userRes.value.users || []);
      if (ruleRes.status === 'fulfilled') setRules(ruleRes.value.rules || null);

      loadHealth();
    } catch (err) {
      console.error('Error loading portal data:', err);
    } finally {
      setLoading(false);
    }
  }, [token, loadHealth]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (token && user) {
      loadPortalData();
    }
  }, [token, user, loadPortalData]);

  const handleLoginSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    setToken(getAuthToken());
    showToast(`Welcome, ${authenticatedUser.fullName || authenticatedUser.username}! Session authenticated as Regulatory Authority.`, 'success');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setToken(null);
    showToast('Logged out of Authority Portal session successfully.', 'info');
  };

  // If not authenticated, render Login view
  if (!token || !user) {
    return (
      <>
        <LoginView onLoginSuccess={handleLoginSuccess} health={health} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        health={health}
      />

      {/* Main Container */}
      <main style={{
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
        flex: 1,
      }}>
        {activeTab === 'dashboard' && (
          <DashboardView
            metrics={metrics}
            batches={batches}
            health={health}
            onRefresh={loadPortalData}
            loading={loading}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'organizations' && (
          <OrganizationsView
            organizations={organizations}
            onRefresh={loadPortalData}
            showToast={showToast}
          />
        )}

        {activeTab === 'users' && (
          <UsersView
            users={users}
            organizations={organizations}
            onRefresh={loadPortalData}
            showToast={showToast}
          />
        )}

        {activeTab === 'supply-chain' && (
          <SupplyChainRulesView
            organizations={organizations}
            rules={rules}
            onRefresh={loadPortalData}
            showToast={showToast}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '1.25rem 2rem',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            PharmaShield AI Platform — Official Regulatory Authority Portal. Connected to MongoDB Atlas & Hardhat Ethereum Ledger.
          </div>
          <div>
            System Version 1.0.0 (Phase 1 Approved Architecture)
          </div>
        </div>
      </footer>

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '420px',
    }}>
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.4)' : isError ? 'rgba(244, 63, 94, 0.4)' : 'var(--border-medium)'}`,
              boxShadow: 'var(--shadow-lg)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isSuccess && <CheckCircle size={18} color="#10b981" />}
              {isError && <AlertCircle size={18} color="#f43f5e" />}
              {!isSuccess && !isError && <Info size={18} color="#06b6d4" />}
              <span style={{ fontSize: '0.85rem', color: '#fff' }}>{toast.message}</span>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'transparent', color: 'var(--text-muted)', padding: '2px' }}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
