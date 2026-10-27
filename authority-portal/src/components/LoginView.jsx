import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, Server, Database, Cpu } from 'lucide-react';
import { api } from '../services/api';

export default function LoginView({ onLoginSuccess, health }) {
  const [username, setUsername] = useState('authority_admin');
  const [password, setPassword] = useState('Admin@123');
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
      background: 'radial-gradient(ellipse at 50% 20%, rgba(6, 182, 212, 0.12), transparent 70%), var(--bg-base)',
      position: 'relative',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-lg), 0 0 40px rgba(6, 182, 212, 0.08)',
        padding: '2.5rem 2rem',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        {/* Header Badge */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 25px rgba(6, 182, 212, 0.5)'
          }}>
            <ShieldCheck size={36} color="#ffffff" />
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
            PharmaShield <span style={{ color: 'var(--cyan-primary)' }}>AI</span>
          </h1>
          <div style={{
            display: 'inline-block',
            background: 'rgba(168, 85, 247, 0.15)',
            color: '#c084fc',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            marginBottom: '0.75rem'
          }}>
            REGULATORY AUTHORITY PORTAL
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Enter your regulatory authority credentials to manage organizations, audit batches, and configure supply chain routes.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            fontSize: '0.82rem',
            marginBottom: '1.5rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#f43f5e' }} />
            <div>{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Username or Official Email
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
            }}>
              <User size={18} color="var(--text-muted)" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="authority_admin"
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  width: '100%',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Password
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
            }}>
              <Lock size={18} color="var(--text-muted)" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
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
              background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
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
              boxShadow: '0 4px 15px rgba(6, 182, 212, 0.35)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Authenticating Authority...' : 'Sign In to Authority Portal'}
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Security & System Status */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={12} color="#10b981" /> Flask API 5000
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} color="#10b981" /> MongoDB Atlas
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={12} color="#10b981" /> Hardhat 31337
            </span>
          </div>
          <p style={{ marginTop: '0.8rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            🔒 Role-enforced authentication. No public signups or wallet keys required.
          </p>
        </div>
      </div>
    </div>
  );
}
