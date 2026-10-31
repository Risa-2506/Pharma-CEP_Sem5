import React, { useState, useEffect, useCallback } from 'react';
import ManufacturerLogin from './components/ManufacturerLogin';
import ManufacturerDashboard from './components/ManufacturerDashboard';
import DistributorDashboard from './components/DistributorDashboard';
import WholesalerDashboard from './components/WholesalerDashboard';
import RetailerDashboard from './components/RetailerDashboard';
import RegisterBatchFlow from './components/RegisterBatchFlow';
import { api, getAuthToken, getStoredUser } from './services/api';
import { 
  Package, 
  Plus, 
  User, 
  LogOut, 
  Wifi, 
  Battery, 
  Building2, 
  ShieldCheck, 
  Cpu,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Truck,
  Boxes,
  Store
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getAuthToken());
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'register', 'profile'
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const userType = user?.organizationType || '';
  const userRole = (user?.role || '').toLowerCase();

  const isDistributor = userType === 'Distributor' || userRole.includes('distributor');
  const isWholesaler = userType === 'Wholesaler' || userRole.includes('wholesaler');
  const isRetailer = userType === 'Retailer' || userType === 'Pharmacy' || userRole.includes('retailer') || userRole.includes('pharmacy');
  const isManufacturer = !isDistributor && !isWholesaler && !isRetailer;

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

  const loadBatches = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.getBatches();
      setBatches(res.batches || []);
    } catch (err) {
      console.warn('Failed to load batches:', err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && user) {
      loadBatches();
    }
  }, [token, user, loadBatches]);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken(null);
      showToast('Your session has expired. Please sign in again.', 'error');
    };
    window.addEventListener('pharmashield:session_expired', handleExpired);
    return () => window.removeEventListener('pharmashield:session_expired', handleExpired);
  }, [showToast]);

  const handleLoginSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    setToken(getAuthToken());
    showToast(`Welcome, ${authenticatedUser.fullName || authenticatedUser.username}! Logged in to Transport App.`, 'success');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setToken(null);
    showToast('Logged out of Transport App.', 'info');
  };

  return (
    <div className="app-container">
      {/* Top Mobile Status Header */}
      <div className="app-status-bar">
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0f172a' }}>9:41 AM</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#059669', fontSize: '0.68rem', fontWeight: 600 }}>
            <Cpu size={11} /> Hardhat 31337
          </span>
          <Wifi size={13} color="#64748b" />
          <Battery size={14} color="#64748b" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="app-content">
        {!token || !user ? (
          <ManufacturerLogin onLoginSuccess={handleLoginSuccess} />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              isDistributor ? (
                <DistributorDashboard
                  user={user}
                  batches={batches}
                  onRefresh={loadBatches}
                  loading={loading}
                  showToast={showToast}
                />
              ) : isWholesaler ? (
                <WholesalerDashboard
                  user={user}
                  batches={batches}
                  onRefresh={loadBatches}
                  loading={loading}
                  showToast={showToast}
                />
              ) : isRetailer ? (
                <RetailerDashboard
                  user={user}
                  batches={batches}
                  onRefresh={loadBatches}
                  loading={loading}
                  showToast={showToast}
                />
              ) : (
                <ManufacturerDashboard
                  user={user}
                  batches={batches}
                  onStartRegistration={() => setActiveTab('register')}
                  onRefresh={loadBatches}
                  loading={loading}
                />
              )
            )}

            {activeTab === 'register' && (
              <RegisterBatchFlow
                user={user}
                onSuccess={(newBatch) => {
                  loadBatches();
                  setActiveTab('dashboard');
                }}
                onCancel={() => setActiveTab('dashboard')}
                showToast={showToast}
              />
            )}

            {activeTab === 'profile' && (
              <div className="animate-slide" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Operator Profile & Licence
                </h2>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid #e2e8f0',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Authenticated Operator</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      {user.fullName || user.username}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                      @{user.username} • {user.email}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Assigned Organisation</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7' }}>
                      {user.organizationName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Role: {user.role} ({user.organizationType || 'Supply Chain Participant'})
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Supply Chain Stage</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>
                      {isManufacturer && 'Stage 1: Production, Packaging & Baseline Registration'}
                      {isDistributor && 'Stage 2: Bulk Receiving, Scan Verification & Onward Dispatch'}
                      {isWholesaler && 'Stage 3: Regional Wholesale Receiving & Pharmacy Distribution'}
                      {isRetailer && 'Stage 4: Pharmacy Counter Verification & Patient Dispensing'}
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <LogOut size={16} /> Sign Out of Workspace
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom App Navigation Bar (Shown when logged in) */}
      {token && user && (
        <nav className="bottom-nav">
          <button
            className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            {isDistributor ? (
              <Truck size={20} />
            ) : isWholesaler ? (
              <Boxes size={20} />
            ) : isRetailer ? (
              <Store size={20} />
            ) : (
              <Package size={20} />
            )}
            <span>
              {isDistributor ? 'Logistics' : isWholesaler ? 'Wholesale' : isRetailer ? 'Pharmacy' : 'Batches'}
            </span>
          </button>

          {isManufacturer && (
            <button
              className="nav-action-btn"
              title="Register New Batch"
              onClick={() => setActiveTab('register')}
            >
              <Plus size={24} />
            </button>
          )}

          <button
            className={`nav-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={20} />
            <span>Profile</span>
          </button>
        </nav>
      )}

      {/* Floating Toast Alerts */}
      {toasts.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '50px',
          left: '12px',
          right: '12px',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {toasts.map(t => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: '#ffffff',
                border: `1px solid ${t.type === 'success' ? '#059669' : t.type === 'error' ? '#dc2626' : '#0284c7'}`,
                boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                fontSize: '0.75rem',
                color: '#0f172a',
                animation: 'slideUp 0.2s ease-out'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {t.type === 'success' && <CheckCircle size={15} color="#059669" />}
                {t.type === 'error' && <AlertCircle size={15} color="#dc2626" />}
                {t.type !== 'success' && t.type !== 'error' && <Info size={15} color="#0284c7" />}
                <span style={{ fontWeight: 600 }}>{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{ background: 'transparent', color: '#64748b', border: 'none' }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
