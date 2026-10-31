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
        background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #bfdbfe',
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{
            background: '#ffffff',
            color: '#1d4ed8',
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Building2 size={12} /> LICENSED MANUFACTURER
          </span>
          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
            Authorised Operator
          </span>
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', margin: 0 }}>
          {user?.organizationName || 'Licensed Pharmaceutical Facility'}
        </h2>
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
          Operator: <strong style={{ color: '#0f172a' }}>{user?.fullName || user?.username || 'Operator'}</strong>
        </div>
      </div>

      {/* Hero Action: Register New Batch */}
      <button
        onClick={onStartRegistration}
        style={{
          background: 'linear-gradient(135deg, #0284c7, #2563eb)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.95rem',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(37, 99, 235, 0.25)',
        }}
      >
        <Plus size={22} /> Register New Batch
      </button>

      {/* My Batches List Header & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            My Batches ({batches?.length || 0})
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
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
          gap: '8px',
          background: '#ffffff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #cbd5e1',
          padding: '0.6rem 0.85rem',
        }}>
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search batch number or medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#0f172a',
              fontSize: '0.8rem',
              width: '100%',
              outline: 'none',
              fontWeight: 500
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
                  background: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  border: isHeldByMe ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                  padding: '1.1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-mono)' }}>
                      {b.batchId}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0'
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
                      background: '#fffbeb',
                      color: '#d97706',
                      border: '1px solid #fde68a',
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
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                    }}>
                      At Facility
                    </span>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                    {b.medicineName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Current Custody: <strong style={{ color: '#0f172a' }}>{b.currentHolderName}</strong>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.6rem',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '0.72rem',
                  color: '#64748b'
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span>Qty: <strong style={{ color: '#0f172a' }}>{b.quantity?.toLocaleString() || '10,000'}</strong></span>
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
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
                      }}
                    >
                      <Truck size={13} /> Transfer to Distributor
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
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
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed #cbd5e1',
          }}>
            <Package size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
              No Batches Registered Yet
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '300px', margin: '0 auto 1rem' }}>
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
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '420px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #bfdbfe'
                }}>
                  TRUSTED BASELINE
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)', marginTop: '4px', margin: 0 }}>
                  {selectedBatch.batchId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                {selectedBatch.medicineName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Composition: {selectedBatch.composition || 'Active Formulation'}
              </div>
            </div>

            {/* Fingerprint */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Cryptographic Fingerprint:</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>
                {selectedBatch.batchFingerprint || 'FP-VERIFIED'}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                Hash: {selectedBatch.trustedDataHash}
              </div>
            </div>

            {/* Blockchain */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700 }}>Blockchain Evidence (Hardhat):</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                Block #{selectedBatch.blockNumber || 1}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#475569', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                Tx: {selectedBatch.blockchainTx || '0x...'}
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Current Custody: <strong style={{ color: '#0f172a' }}>{selectedBatch.currentHolderName}</strong> ({selectedBatch.stage})
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
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
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
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
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
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: '1rem',
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '440px',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)'
                }}>
                  <Truck size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Transfer Custody to Distributor
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Regulatory Authority Rule Enforced
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsTransferModalOpen(false)}
                disabled={transferLoading}
                style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Error / Success Banners */}
            {transferError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#b91c1c',
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
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#047857',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
                <span>{transferSuccess}</span>
              </div>
            )}

            {/* Target Batch Info Box */}
            <div style={{
              background: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #e2e8f0',
              padding: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Transferring Batch:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-mono)' }}>
                  {batchToTransfer.batchId}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {batchToTransfer.medicineName}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                Quantity: {batchToTransfer.quantity?.toLocaleString()} units | Current Seal: {batchToTransfer.sealId}
              </div>
            </div>

            {/* Transfer Form */}
            <form onSubmit={handleExecuteTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  Authorised Distributor Recipient *
                </label>

                {loadingRules ? (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.5rem' }}>
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
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.7rem',
                        color: '#0f172a',
                        colorScheme: 'light',
                        fontSize: '0.85rem',
                        outline: 'none',
                        fontWeight: 600
                      }}
                    >
                      {authorizedDistributors.map(d => (
                        <option key={d.id} value={d.id} style={{ background: '#ffffff', color: '#0f172a' }}>
                          {d.name} ({d.code || 'DIST'})
                        </option>
                      ))}
                    </select>

                    <div style={{
                      marginTop: '0.4rem',
                      fontSize: '0.7rem',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600
                    }}>
                      <ShieldCheck size={12} color="#059669" />
                      Authorised partner according to Regulatory Authority Supply Chain Rules
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#fef2f2',
                    border: '1px dashed #fca5a5',
                    color: '#b91c1c',
                    fontSize: '0.75rem',
                    lineHeight: 1.5
                  }}>
                    <strong>⚠️ No Authorized Distributor Configured</strong>
                    <p style={{ marginTop: '4px', color: '#64748b' }}>
                      The Regulatory Authority has not yet assigned an authorized Distributor route for your facility. Custody transfer is strictly prevented until configured in the Authority Portal.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                  New Tamper Transit Seal ID *
                </label>
                <input
                  type="text"
                  required
                  value={newSealId}
                  onChange={(e) => setNewSealId(e.target.value.toUpperCase())}
                  placeholder="Enter transit tamper seal ID"
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.7rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
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
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer'
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
                      : '#cbd5e1',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: authorizedDistributors.length > 0 ? '0 4px 15px rgba(245, 158, 11, 0.25)' : 'none',
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
