import React from 'react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Building2, 
  Users, 
  GitFork, 
  LogOut, 
  Activity,
  Layers
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onLogout, health }) {
  const isHealthy = health?.status === 'HEALTHY';
  const blockchainConnected = health?.blockchain?.connected;

  return (
    <header style={{
      background: '#ffffff',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.75rem 2rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
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
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                PharmaShield <span style={{ color: '#0284c7' }}>AI</span>
              </span>
              <span style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #bfdbfe',
                letterSpacing: '0.05em'
              }}>
                AUTHORITY PORTAL
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              National Drug Regulatory & Supply Chain Integrity Authority
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'organizations', label: 'Organisations', icon: Building2 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'supply-chain', label: 'Supply Chain Rules', icon: GitFork },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: isActive ? '#eff6ff' : 'transparent',
                  color: isActive ? '#1d4ed8' : '#475569',
                  border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                  boxShadow: isActive ? '0 1px 2px rgba(29, 78, 216, 0.08)' : 'none',
                }}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Info & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 600,
              background: blockchainConnected ? '#ecfdf5' : '#fef2f2',
              color: blockchainConnected ? '#059669' : '#dc2626',
              border: `1px solid ${blockchainConnected ? '#a7f3d0' : '#fecaca'}`
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: blockchainConnected ? '#059669' : '#dc2626',
              }} />
              {blockchainConnected ? 'Hardhat Ledger Connected' : 'Blockchain Offline'}
            </span>
          </div>

          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '0.75rem', borderLeft: '1px solid var(--border-subtle)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                {user?.fullName || user?.username || 'Authority Admin'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600 }}>
                {user?.role || 'Regulatory Authority'}
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Logout session"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
