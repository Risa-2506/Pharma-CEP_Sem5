import React, { useState, useEffect } from 'react';
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
  Filter,
  Truck,
  ArrowRight,
  AlertCircle,
  Lock,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';

export default function ManufacturerDashboard({ 
  user, 
  batches, 
  onStartRegistration, 
  onRefresh, 
  loading 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Transfer Custody Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [batchToTransfer, setBatchToTransfer] = useState(null);
  const [authorizedDistributors, setAuthorizedDistributors] = useState([]);
  const [allDistributors, setAllDistributors] = useState([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [newSealId, setNewSealId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [loadingRules, setLoadingRules] = useState(false);

  const filteredBatches = (batches || []).filter(b => 
    b.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.medicineName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openTransferModal = async (batch, e) => {
    if (e) e.stopPropagation();
    setBatchToTransfer(batch);
    setTransferError('');
    setTransferSuccess('');
    setNewSealId(`SEAL-TR-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsTransferModalOpen(true);
    setLoadingRules(true);

    try {
      // 1. Fetch active organizations of type Distributor
      const orgsRes = await api.getOrganizations({ status: 'Active' });
      const orgList = orgsRes.organizations || [];
      const distList = orgList.filter(o => o.type === 'Distributor');
      setAllDistributors(distList);

      // 2. Fetch supply chain rules configured by the Regulatory Authority
      const rulesRes = await api.getSupplyChainRules();
      const rule = rulesRes.rule || {};
      const transitions = rule.allowedTransitions || [];
      const relationships = rule.relationships || [];

      // Current manufacturer's identity
      const myOrgName = user?.organizationName || '';
      const myOrgId = user?.organizationId || '';

      // Determine authorized distributors
      const authorizedIds = new Set();
      const authorizedNames = new Set();

      // Check transitions: from Manufacturer -> Distributor
      transitions.forEach(t => {
        const fromMatches = (t.fromOrg === myOrgName) || (t.from === 'Manufacturer');
        if (fromMatches) {
          if (t.toOrg) authorizedNames.add(t.toOrg);
        }
      });

      // Check pipeline relationships: finding who comes immediately after Manufacturer
      if (relationships.length > 0) {
        let foundIdx = -1;
        relationships.forEach((rel, idx) => {
          if (rel.orgId === myOrgId || rel.orgName === myOrgName || rel.type === 'Manufacturer') {
            foundIdx = idx;
          }
        });
        if (foundIdx !== -1 && foundIdx + 1 < relationships.length) {
          const nextHop = relationships[foundIdx + 1];
          if (nextHop.orgId) authorizedIds.add(String(nextHop.orgId));
          if (nextHop.orgName) authorizedNames.add(nextHop.orgName);
        }
      }

      // Filter distributor list strictly to authorized partners
      const matched = distList.filter(d => 
        authorizedIds.has(String(d.id)) || 
        authorizedNames.has(d.name) ||
        (authorizedIds.size === 0 && authorizedNames.size === 0) // fallback if rule allows any active distributor
      );

      setAuthorizedDistributors(matched);
      if (matched.length > 0) {
        setSelectedReceiverId(matched[0].id);
      } else {
        setSelectedReceiverId('');
      }
    } catch (err) {
      setTransferError('Failed to load supply chain authorization rules: ' + (err.message || 'Network error'));
    } finally {
      setLoadingRules(false);
    }
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    if (!selectedReceiverId) {
      setTransferError('Please select an authorized distributor recipient.');
      return;
    }
    if (!newSealId.trim()) {
      setTransferError('A transit tamper seal ID is required.');
      return;
    }

    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');

    try {
      const res = await api.transferBatch(batchToTransfer.batchId, {
        receiverId: selectedReceiverId,
        newSealId: newSealId.trim(),
      });

      setTransferSuccess(res.message || 'Batch custody transferred successfully onto blockchain ledger!');
      setTimeout(() => {
        setIsTransferModalOpen(false);
        if (selectedBatch && selectedBatch.batchId === batchToTransfer.batchId) {
          setSelectedBatch(null);
        }
        onRefresh();
      }, 1600);
    } catch (err) {
      setTransferError(err.message || 'Transfer failed. Verify authority rule authorization.');
    } finally {
      setTransferLoading(false);
    }
  };

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
          Operator: <strong style={{ color: '#fff' }}>{user?.fullName || user?.username || 'Operator'}</strong>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredBatches && filteredBatches.length > 0 ? (
          filteredBatches.map(b => {
            const isHeldByMe = b.stage === 'Manufacturer' && b.status !== 'In Transit';
            const isInTransit = b.status === 'In Transit';

            return (
              <div
                key={b.id || b.batchId}
                onClick={() => setSelectedBatch(b)}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: isHeldByMe ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid var(--border-subtle)',
                  padding: '1.1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-card)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                      {b.batchId}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      ✓ Verified
                    </span>
                  </div>

                  {isInTransit ? (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Truck size={12} /> In Transit
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(6, 182, 212, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                    }}>
                      At Facility
                    </span>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                    {b.medicineName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Current Custody: <strong style={{ color: '#e2e8f0' }}>{b.currentHolderName}</strong>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.6rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span>Qty: <strong style={{ color: '#fff' }}>{b.quantity?.toLocaleString() || '10,000'}</strong></span>
                    <span>Exp: {b.expiryDate}</span>
                    <span>Seal: {b.sealId}</span>
                  </div>

                  {isHeldByMe ? (
                    <button
                      type="button"
                      onClick={(e) => openTransferModal(b, e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      <Truck size={13} /> Transfer to Distributor
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Transferred
                    </span>
                  )}
                </div>
              </div>
            );
          })
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
      {selectedBatch && !isTransferModalOpen && (
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
                Composition: {selectedBatch.composition || 'Active Formulation'}
              </div>
            </div>

            {/* Fingerprint */}
            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Cryptographic Fingerprint:</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc', fontFamily: 'var(--font-mono)' }}>
                {selectedBatch.batchFingerprint || 'FP-VERIFIED'}
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
              Current Custody: <strong style={{ color: '#fff' }}>{selectedBatch.currentHolderName}</strong> ({selectedBatch.stage})
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              {selectedBatch.stage === 'Manufacturer' && selectedBatch.status !== 'In Transit' && (
                <button
                  type="button"
                  onClick={() => openTransferModal(selectedBatch)}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Truck size={15} /> Transfer to Distributor
                </button>
              )}

              <button
                onClick={() => setSelectedBatch(null)}
                style={{
                  padding: '0.7rem 1.25rem',
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
        </div>
      )}

      {/* Custody Transfer Modal (Restricted to Authorized Distributor) */}
      {isTransferModalOpen && batchToTransfer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: '1rem',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '440px',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Truck size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                    Transfer Custody to Distributor
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Regulatory Authority Rule Enforced
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsTransferModalOpen(false)}
                disabled={transferLoading}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.2rem', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Error / Success Banners */}
            {transferError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#fca5a5',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldAlert size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{transferError}</span>
              </div>
            )}

            {transferSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#6ee7b7',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                <span>{transferSuccess}</span>
              </div>
            )}

            {/* Target Batch Info Box */}
            <div style={{
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Transferring Batch:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  {batchToTransfer.batchId}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {batchToTransfer.medicineName}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Quantity: {batchToTransfer.quantity?.toLocaleString()} units | Current Seal: {batchToTransfer.sealId}
              </div>
            </div>

            {/* Transfer Form */}
            <form onSubmit={handleExecuteTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Authorised Distributor Recipient *
                </label>

                {loadingRules ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                    Verifying authorized distributor rules...
                  </div>
                ) : authorizedDistributors.length > 0 ? (
                  <div>
                    <select
                      value={selectedReceiverId}
                      onChange={(e) => setSelectedReceiverId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        background: 'var(--bg-input)',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.7rem',
                        color: '#fff',
                        fontSize: '0.85rem',
                      }}
                    >
                      {authorizedDistributors.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code || 'DIST'})
                        </option>
                      ))}
                    </select>

                    <div style={{
                      marginTop: '0.4rem',
                      fontSize: '0.7rem',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ShieldCheck size={12} color="#10b981" />
                      Authorised partner according to Regulatory Authority Supply Chain Rules
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px dashed rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    fontSize: '0.75rem',
                    lineHeight: 1.5
                  }}>
                    <strong>⚠️ No Authorized Distributor Configured</strong>
                    <p style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                      The Regulatory Authority has not yet assigned an authorized Distributor route for your facility. Custody transfer is strictly prevented until configured in the Authority Portal.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  New Tamper Transit Seal ID *
                </label>
                <input
                  type="text"
                  required
                  value={newSealId}
                  onChange={(e) => setNewSealId(e.target.value.toUpperCase())}
                  placeholder="e.g. SEAL-TR-4091"
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.7rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  New seal applied during dispatch; will be anchored onto the Hardhat smart contract.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={transferLoading}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    border: '1px solid var(--border-medium)'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={transferLoading || authorizedDistributors.length === 0}
                  style={{
                    flex: 1.5,
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: authorizedDistributors.length > 0 
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
                      : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: authorizedDistributors.length > 0 ? '0 4px 15px rgba(245, 158, 11, 0.4)' : 'none',
                    cursor: authorizedDistributors.length > 0 ? 'pointer' : 'not-allowed',
                    opacity: transferLoading ? 0.7 : 1
                  }}
                >
                  {transferLoading ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      Anchoring on Chain...
                    </>
                  ) : (
                    <>
                      Confirm Transfer <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
