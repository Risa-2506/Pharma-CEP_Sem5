import React, { useState } from 'react';
import { 
  Plus, 
  Package, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  ChevronRight, 
  Building2, 
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

export default function ManufacturerDashboard({ 
  user, 
  batches, 
  onStartRegistration, 
  onRefresh, 
  loading 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);

  const filteredBatches = (batches || []).filter(b => 
    b.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.medicineName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-slide" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Organisation Badge & Operator Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(37, 99, 235, 0.12))',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span className="badge-mfg">
            <Building2 size={12} /> LICENSED MANUFACTURER
          </span>
          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Authorised Operator
          </span>
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
          {user?.organizationName || 'Apex Pharma Pvt. Ltd.'}
        </h2>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
          Operator: <strong style={{ color: '#fff' }}>{user?.fullName || user?.username || 'Aarav Sharma'}</strong>
        </div>
      </div>

      {/* Hero Action: Register New Batch */}
      <button
        onClick={onStartRegistration}
        style={{
          background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.95rem',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 6px 20px rgba(6, 182, 212, 0.4)',
        }}
      >
        <Plus size={22} /> Register New Batch
      </button>

      {/* My Batches List Header & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
            My Batches ({batches?.length || 0})
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Sync
          </button>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '0.55rem 0.85rem',
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search batch number or medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '0.8rem',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Batches Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredBatches && filteredBatches.length > 0 ? (
          filteredBatches.map(b => (
            <div
              key={b.id || b.batchId}
              onClick={() => setSelectedBatch(b)}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-card)',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {b.batchId}
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    ✓ Verified
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                  {b.medicineName}
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '10px' }}>
                  <span>Qty: {b.quantity?.toLocaleString() || '10,000'}</span>
                  <span>Exp: {b.expiryDate}</span>
                  <span>Seal: {b.sealId}</span>
                </div>
              </div>

              <ChevronRight size={18} color="var(--text-muted)" />
            </div>
          ))
        ) : (
          <div style={{
            padding: '2.5rem 1rem',
            textAlign: 'center',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-medium)',
          }}>
            <Package size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>
              No Batches Registered Yet
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '300px', margin: '0 auto 1rem' }}>
              Click <strong>Register New Batch</strong> above to upload packaging images, extract AI verification, and anchor your trusted baseline to the blockchain.
            </p>
          </div>
        )}
      </div>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '420px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge-mfg">TRUSTED BASELINE</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {selectedBatch.batchId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                {selectedBatch.medicineName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Composition: {selectedBatch.composition || 'Pantoprazole 40 mg'}
              </div>
            </div>

            {/* Fingerprint */}
            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Cryptographic Fingerprint:</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc', fontFamily: 'var(--font-mono)' }}>
                {selectedBatch.batchFingerprint || 'FP-8392F1A0B2C9'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                Hash: {selectedBatch.trustedDataHash}
              </div>
            </div>

            {/* Blockchain */}
            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>Blockchain Evidence (Hardhat):</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Block #{selectedBatch.blockNumber || 1}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                Tx: {selectedBatch.blockchainTx || '0x...'}
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Current Custody: <strong style={{ color: '#fff' }}>{selectedBatch.currentHolderName || 'Apex Pharma Pvt. Ltd.'}</strong>
            </div>

            <button
              onClick={() => setSelectedBatch(null)}
              style={{
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
