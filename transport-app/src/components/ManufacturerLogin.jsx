import React, { useState } from 'react';
import { Truck, ShieldCheck, Lock, User, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { api } from '../services/api';

export default function ManufacturerLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login(username, password);
      if (res.user?.role === 'Authority') {
        api.logout();
        setError('Regulatory Authority accounts must use the Authority Web Portal, not the Transport App.');
        setLoading(false);
        return;
      }
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Login failed. Verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100%',
      padding: '1.5rem 0.5rem',
      animation: 'slideUp 0.3s ease-out'
    }}>
      {/* App Branding */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #0284c7, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          boxShadow: '0 4px 16px rgba(2, 132, 199, 0.3)'
        }}>
          <Truck size={30} color="#ffffff" />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          PharmaShield <span style={{ color: '#0284c7' }}>Transport</span>
        </h1>
        <div style={{
          display: 'inline-block',
          background: '#eff6ff',
          color: '#1d4ed8',
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: '8px',
          border: '1px solid #bfdbfe',
          marginBottom: '0.5rem'
        }}>
          SUPPLY CHAIN OPERATOR WORKSPACE
        </div>
        <p style={{ fontSize: '0.8rem', color: '#475569' }}>
          Manufacturer, Distributor, Wholesaler & Pharmacy Portal
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          color: '#dc2626',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '1.25rem'
        }}>
          <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Login Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        padding: '1.75rem 1.25rem',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.08)'
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Operator Username
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-md)',
              padding: '0.7rem 0.9rem',
            }}>
              <User size={16} color="#64748b" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter authorized username"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  width: '100%',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Password
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-md)',
              padding: '0.7rem 0.9rem',
            }}>
              <Lock size={16} color="#64748b" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  width: '100%',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Authenticating Operator...' : 'Sign In to Workspace'}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
