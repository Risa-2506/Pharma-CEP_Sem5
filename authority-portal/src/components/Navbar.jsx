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
      background: 'rgba(13, 21, 38, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.75rem 2rem'
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
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                PharmaShield <span style={{ color: '#06b6d4' }}>AI</span>
              </span>
              <span style={{
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                letterSpacing: '0.05em'
              }}>
                AUTHORITY PORTAL
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                  background: isActive ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))' : 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 15px rgba(6, 182, 212, 0.15)' : 'none',
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
              background: blockchainConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
              color: blockchainConnected ? '#10b981' : '#f43f5e',
              border: `1px solid ${blockchainConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: blockchainConnected ? '#10b981' : '#f43f5e',
                boxShadow: blockchainConnected ? '0 0 8px #10b981' : 'none'
              }} />
              {blockchainConnected ? 'Hardhat Ledger' : 'Blockchain Offline'}
            </span>
          </div>

          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '0.75rem', borderLeft: '1px solid var(--border-subtle)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                {user?.fullName || user?.username || 'Authority Admin'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 600 }}>
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
                background: 'rgba(244, 63, 94, 0.12)',
                color: '#f43f5e',
                border: '1px solid rgba(244, 63, 94, 0.25)',
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
