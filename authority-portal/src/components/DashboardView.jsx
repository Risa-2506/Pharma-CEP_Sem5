import React from 'react';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Ban, 
  Layers, 
  Building2, 
  GitFork, 
  Cpu, 
  Database, 
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function DashboardView({ 
  metrics, 
  batches, 
  health, 
  onRefresh, 
  loading,
  setActiveTab 
}) {
  const m = metrics || {
    totalActive: 0,
    inTransit: 0,
    verified: 0,
    discrepancies: 0,
    blocked: 0,
  };

  const statCards = [
    {
      label: 'Total Active Batches',
      value: m.totalActive,
      icon: Package,
      gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      glow: 'rgba(6, 182, 212, 0.25)',
      description: 'Tracked across all supply chain stages'
    },
    {
      label: 'In Transit',
      value: m.inTransit,
      icon: Truck,
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      glow: 'rgba(245, 158, 11, 0.25)',
      description: 'Moving between authorized custody'
    },
    {
      label: 'AI & Hash Verified',
      value: m.verified,
      icon: CheckCircle2,
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      glow: 'rgba(16, 185, 129, 0.25)',
      description: 'Cryptographically consistent packages'
    },
    {
      label: 'Discrepancies',
      value: m.discrepancies,
      icon: AlertTriangle,
      gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)',
      glow: 'rgba(244, 63, 94, 0.25)',
      description: 'Flagged composition / route anomalies'
    },
    {
      label: 'Blocked Batches',
      value: m.blocked,
      icon: Ban,
      gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
      glow: 'rgba(239, 68, 68, 0.25)',
      description: 'Regulatory holds active'
    },
  ];

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner / Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Regulatory Authority Monitoring Dashboard
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Real-time national pharmaceutical surveillance, custody transitions & verification status.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-medium)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing...' : 'Refresh Live Status'}
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem'
      }}>
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 8px 24px -6px rgba(0,0,0,0.4)`,
              }}
            >
              {/* Subtle accent glow */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '90px',
                height: '90px',
                background: card.glow,
                filter: 'blur(35px)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {card.label}
                </span>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: card.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 14px ${card.glow}`
                }}>
                  <Icon size={20} color="#ffffff" />
                </div>
              </div>

              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginBottom: '0.5rem' }}>
                {card.value}
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {card.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Batches Monitor + Blockchain Architecture Info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Batches Monitoring Table / Empty State */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                Active Batch Custody Monitor
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Live pharmaceutical tracking feed across supply chain stages.
              </p>
            </div>
          </div>

          {batches && batches.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem' }}>Batch ID</th>
                    <th style={{ padding: '0.75rem' }}>Medicine</th>
                    <th style={{ padding: '0.75rem' }}>Current Holder</th>
                    <th style={{ padding: '0.75rem' }}>Stage</th>
                    <th style={{ padding: '0.75rem' }}>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id || b.batchId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {b.batchId}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#fff' }}>{b.medicineName}</td>
                      <td style={{ padding: '0.75rem' }}>{b.currentHolderName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-manufacturer">{b.stage}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-active">{b.verificationStatus}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '3.5rem 2rem',
              textAlign: 'center',
              background: 'rgba(18, 29, 51, 0.5)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-medium)',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(6, 182, 212, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}>
                <Package size={28} color="#06b6d4" />
              </div>

              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                No active batches yet
              </h4>
              <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                maxWidth: '440px',
                margin: '0 auto 1.5rem',
                lineHeight: 1.6
              }}>
                Batches will appear here automatically when manufacturers register them through the <strong>Transport App</strong>.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button
                  onClick={() => setActiveTab('organizations')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <Building2 size={15} /> Configure Organisations
                </button>

                <button
                  onClick={() => setActiveTab('supply-chain')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <GitFork size={15} /> View Supply Chain Rules
                </button>
              </div>
            </div>
          )}
        </div>

        {/* System & Ledger Infrastructure Card */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="#06b6d4" /> Ledger & Infrastructure
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Underlying immutable audit and AI subsystems.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Blockchain Subsystem */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={15} /> Solidity Smart Contract
                </span>
                <span className="badge badge-active">Live (Chain 31337)</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Contract Address:
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '4px 8px',
                borderRadius: '4px',
                color: '#e2e8f0',
                wordBreak: 'break-all'
              }}>
                {health?.blockchain?.contractAddress || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Owner: {health?.blockchain?.owner || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'}
              </div>
            </div>

            {/* Database Subsystem */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={15} /> MongoDB Atlas
                </span>
                <span className="badge badge-active">Operational</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Database: <code style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>pharmashield</code>
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Index-enforced schemas for zero duplicate batches or unauthorized records.
              </p>
            </div>

            {/* AI Vision Subsystem */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={15} /> AI Verification Engine
                </span>
                <span className="badge badge-authority">Vision + OCR</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Model: Groq Qwen Vision (qwen/qwen3.8-27b) + Tesseract OCR
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
