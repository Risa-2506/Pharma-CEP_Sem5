import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, Server, Database, Cpu } from 'lucide-react';
import { api } from '../services/api';

export default function LoginView({ onLoginSuccess, health }) {
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
      if (res.user?.role !== 'Authority' && !res.user?.role?.includes('Authority')) {
        api.logout();
        setError(`Access Denied: Non-Authority role '${res.user?.role}' detected. Supply chain participants must use the Transport App.`);
        setLoading(false);
        return;
      }
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(2, 132, 199, 0.08), transparent 70%), #f8fafc',
      position: 'relative',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#ffffff',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        padding: '2.5rem 2rem',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        {/* Header Badge */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 16px rgba(2, 132, 199, 0.3)'
          }}>
            <ShieldCheck size={36} color="#ffffff" />
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
            PharmaShield <span style={{ color: '#0284c7' }}>AI</span>
          </h1>
          <div style={{
            display: 'inline-block',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 12px',
            borderRadius: '12px',
            border: '1px solid #bfdbfe',
            marginBottom: '0.75rem'
          }}>
            REGULATORY AUTHORITY PORTAL
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Enter your regulatory authority credentials to manage organizations, audit batches, and configure supply chain routes.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            color: '#b91c1c',
            fontSize: '0.82rem',
            marginBottom: '1.5rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
            <div>{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Username or Official Email
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
            }}>
              <User size={18} color="#64748b" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter authority username"
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0f172a',
                  width: '100%',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Password
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
            }}>
              <Lock size={18} color="#64748b" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0f172a',
                  width: '100%',
                  fontSize: '0.9rem',
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
              fontSize: '0.95rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Authenticating Authority...' : 'Sign In to Authority Portal'}
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Security & System Status */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={12} color="#059669" /> Flask API 5000
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} color="#059669" /> MongoDB Atlas
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={12} color="#059669" /> Hardhat 31337
            </span>
          </div>
          <p style={{ marginTop: '0.8rem', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
            🔒 Role-enforced authentication. No public signups or wallet keys required.
          </p>
        </div>
      </div>
    </div>
  );
}
