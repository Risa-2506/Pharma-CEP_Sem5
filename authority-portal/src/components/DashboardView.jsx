import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  ExternalLink,
  ChevronRight,
  Factory,
  Store,
  Warehouse,
  ShieldAlert,
  ArrowRight,
  Clock,
  Check,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function DashboardView({ 
  metrics, 
  batches, 
  health, 
  rules: rulesProp,
  onRefresh, 
  loading,
  setActiveTab 
}) {
  const [auditBatchId, setAuditBatchId] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [rules, setRules] = useState(rulesProp || null);

  // Sync rules from props if provided
  useEffect(() => {
    if (rulesProp) {
      setRules(rulesProp);
    }
  }, [rulesProp]);

  // Lock body scroll when audit modal is open
  useEffect(() => {
    if (auditBatchId) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [auditBatchId]);

  // Load supply chain rules to know configured partners per stage
  useEffect(() => {
    async function loadRules() {
      try {
        const res = await api.getSupplyChainRules();
        if (res.rules) {
          setRules(res.rules);
        } else if (res.rule) {
          setRules(res.rule);
        }
      } catch (err) {
        console.warn('Could not load supply chain rules for dashboard stepper:', err);
      }
    }
    loadRules();
  }, []);

  const openBlockchainAudit = async (batchId) => {
    setAuditBatchId(batchId);
    setAuditLoading(true);
    setAuditError('');
    setAuditData(null);

    try {
      const res = await api.getBatchBlockchainAudit(batchId);
      setAuditData(res);
    } catch (err) {
      setAuditError(err.message || 'Failed to read on-chain ledger events from Hardhat node.');
    } finally {
      setAuditLoading(false);
    }
  };

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

  // Helper to determine stage status for visual stepper
  const getStageStatus = (batch, stageKey) => {
    // stageKey: 'Manufacturer', 'Distributor', 'Wholesaler', 'Retailer'
    const currentStage = batch.stage || 'Manufacturer';
    const isInTransit = batch.status === 'In Transit';

    const order = ['Manufacturer', 'Distributor', 'Wholesaler', 'Retailer'];
    const currentIdx = order.indexOf(currentStage);
    const targetIdx = order.indexOf(stageKey);

    if (stageKey === 'Manufacturer') {
      return { completed: true, active: currentIdx === 0 && !isInTransit, inTransit: false };
    }

    if (stageKey === 'Distributor') {
      if (currentStage === 'Distributor' && !isInTransit) {
        return { completed: true, active: true, inTransit: false };
      }
      if (isInTransit && currentStage === 'Distributor') {
        return { completed: false, active: true, inTransit: true };
      }
      if (currentIdx > 1) {
        return { completed: true, active: false, inTransit: false };
      }
      return { completed: false, active: false, inTransit: false };
    }

    if (stageKey === 'Wholesaler') {
      if (currentStage === 'Wholesaler' && !isInTransit) {
        return { completed: true, active: true, inTransit: false };
      }
      if (isInTransit && currentStage === 'Wholesaler') {
        return { completed: false, active: true, inTransit: true };
      }
      if (currentIdx > 2) {
        return { completed: true, active: false, inTransit: false };
      }
      return { completed: false, active: false, inTransit: false };
    }

    if (stageKey === 'Retailer') {
      if (currentStage === 'Retailer' && !isInTransit) {
        return { completed: true, active: true, inTransit: false };
      }
      if (isInTransit && currentStage === 'Retailer') {
        return { completed: false, active: true, inTransit: true };
      }
      return { completed: false, active: false, inTransit: false };
    }

    return { completed: false, active: false, inTransit: false };
  };

  // Find partner name for each stage based on active batch or authority rules
  const getStagePartnerName = (batch, stageKey) => {
    if (stageKey === 'Manufacturer') {
      return batch.manufacturerName || 'Manufacturer Facility';
    }

    // 1. Current holder check if batch is currently at or in-transit to this stage
    if (batch.stage === stageKey) {
      return batch.currentHolderName || `Authorized ${stageKey}`;
    }

    // 2. Check the batch's actual transfer history (receiver or sender at this stage)
    const transfers = batch.transferHistory || [];
    for (const t of transfers) {
      if (t.receiverStage === stageKey && t.receiverOrgName) {
        return t.receiverOrgName;
      }
      if (t.senderStage === stageKey && t.senderOrgName) {
        return t.senderOrgName;
      }
    }

    // 3. Check the batch's receipt history
    const receipts = batch.receiptHistory || [];
    const rMatch = receipts.find(r => r.stage === stageKey);
    if (rMatch?.organization) {
      return rMatch.organization;
    }

    // 4. Fallback to Authority rules (check both stage and type keys)
    const rels = rules?.relationships || [];
    const relMatch = rels.find(r => r.stage === stageKey || r.type === stageKey);
    if (relMatch?.orgName) return relMatch.orgName;

    const trans = rules?.allowedTransitions || [];
    const transMatch = trans.find(t => t.to === stageKey || t.from === stageKey);
    if (transMatch?.to === stageKey && transMatch.toOrg) return transMatch.toOrg;
    if (transMatch?.from === stageKey && transMatch.fromOrg) return transMatch.fromOrg;

    return `Authorized ${stageKey}`;
  };

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
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Regulatory Authority Monitoring Dashboard
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#475569' }}>
            Real-time national pharmaceutical surveillance, visual custody transitions & on-chain verification.
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
                background: '#ffffff',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
              }}
            >
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
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
                  boxShadow: `0 2px 8px ${card.glow}`
                }}>
                  <Icon size={20} color="#ffffff" />
                </div>
              </div>

              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginBottom: '0.5rem' }}>
                {card.value}
              </div>

              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {card.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Section: Visual Batch Custody Stepper Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1.5rem',
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid #e2e8f0',
          padding: '1.75rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitFork size={20} color="#0284c7" /> Visual Batch Custody Pipeline Monitor
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                Live end-to-end stage verification: boxes highlight upon stage completion and disable until reached.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#059669', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} /> Completed / Verified
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#d97706', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} /> In Transit
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} /> Pending / Disabled
              </span>
            </div>
          </div>

          {batches && batches.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {batches.map(b => {
                const stages = [
                  { key: 'Manufacturer', label: 'Manufacturer', icon: Factory },
                  { key: 'Distributor', label: 'Distributor', icon: Truck },
                  { key: 'Wholesaler', label: 'Wholesaler', icon: Warehouse },
                  { key: 'Retailer', label: 'Retailer / Pharmacy', icon: Store },
                ];

                const isBlocked = b.status === 'Blocked';

                return (
                  <div
                    key={b.id || b.batchId}
                    style={{
                      background: '#ffffff',
                      borderRadius: 'var(--radius-xl)',
                      border: isBlocked 
                        ? '1px solid #fca5a5' 
                        : '1px solid #e2e8f0',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Batch Card Header Info */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Batch Identification
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                            {b.batchId}
                          </div>
                        </div>

                        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Medicine & Formulation</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{b.medicineName}</div>
                        </div>

                        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Quantity / Seal</div>
                          <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                            {b.quantity?.toLocaleString() || '10,000'} units | <code style={{ color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>{b.sealId}</code>
                          </div>
                        </div>
                      </div>

                      {/* Badges & Blockchain Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-active" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> {b.verificationStatus || 'AI Verified'}
                        </span>

                        {isBlocked ? (
                          <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                            <Ban size={12} /> Regulatory Hold
                          </span>
                        ) : (
                          <span className="badge badge-authority">
                            Stage: {b.stage}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => openBlockchainAudit(b.batchId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            padding: '0.45rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(29, 78, 216, 0.08)'
                          }}
                        >
                          <Cpu size={14} color="#1d4ed8" /> On-Chain Ledger Audit
                        </button>
                      </div>
                    </div>

                    {/* Visual Stepper Pipeline: [Manufacturer] ──► [Distributor] ──► [Wholesaler] ──► [Retailer] */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '1rem',
                      position: 'relative',
                      marginTop: '0.5rem'
                    }}>
                      {stages.map((stg, sIdx) => {
                        const status = getStageStatus(b, stg.key);
                        const partnerName = getStagePartnerName(b, stg.key);
                        const StageIcon = stg.icon;

                        // Stage box style calculation
                        let boxBorder = '1px dashed #cbd5e1';
                        let boxBg = '#f8fafc';
                        let iconColor = '#94a3b8';
                        let textColor = '#64748b';
                        let subTextColor = '#94a3b8';
                        let badgeBg = '#f1f5f9';
                        let badgeColor = '#64748b';
                        let badgeText = 'Pending';
                        let opacity = 0.65;

                        if (status.completed && !status.inTransit) {
                          boxBorder = '1px solid #86efac';
                          boxBg = '#f0fdf4';
                          iconColor = '#059669';
                          textColor = '#0f172a';
                          subTextColor = '#475569';
                          badgeBg = '#dcfce7';
                          badgeColor = '#166534';
                          badgeText = stg.key === 'Manufacturer' ? 'Produced & Baseline Anchored' : 'Custody Verified';
                          opacity = 1;
                        } else if (status.inTransit) {
                          boxBorder = '1px solid #fde68a';
                          boxBg = '#fffbeb';
                          iconColor = '#d97706';
                          textColor = '#0f172a';
                          subTextColor = '#92400e';
                          badgeBg = '#fef3c7';
                          badgeColor = '#92400e';
                          badgeText = '🚚 In Transit (Dispatched)';
                          opacity = 1;
                        }

                        // Arrow styling for next hop
                        const nextStage = stages[sIdx + 1];
                        const nextStatus = nextStage ? getStageStatus(b, nextStage.key) : null;
                        const isArrowActive = status.completed || status.inTransit;

                        return (
                          <div key={stg.key} style={{ position: 'relative' }}>
                            <div style={{
                              background: boxBg,
                              border: boxBorder,
                              borderRadius: 'var(--radius-lg)',
                              padding: '1.25rem 1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.6rem',
                              opacity: opacity,
                              transition: 'all 0.3s ease',
                              boxShadow: status.completed ? '0 1px 3px rgba(16, 185, 129, 0.08)' : 'none',
                              minHeight: '135px',
                              justifyContent: 'space-between',
                            }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: status.completed ? '#059669' : (status.inTransit ? '#d97706' : '#94a3b8'),
                                    letterSpacing: '0.04em'
                                  }}>
                                    Stage {sIdx + 1}: {stg.label}
                                  </span>
                                  <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: status.completed 
                                      ? '#dcfce7' 
                                      : (status.inTransit ? '#fef3c7' : '#f1f5f9'),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <StageIcon size={16} color={iconColor} />
                                  </div>
                                </div>

                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: textColor, lineHeight: 1.25 }}>
                                  {partnerName}
                                </div>
                              </div>

                              <div style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeColor}33`,
                                textAlign: 'center',
                                display: 'inline-block'
                              }}>
                                {badgeText}
                              </div>
                            </div>

                            {/* Arrow pointing to next stage box */}
                            {sIdx < stages.length - 1 && (
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                right: '-14px',
                                transform: 'translateY(-50%)',
                                zIndex: 2,
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: isArrowActive ? '#0284c7' : '#ffffff',
                                border: `1px solid ${isArrowActive ? '#0284c7' : '#cbd5e1'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isArrowActive ? '0 2px 6px rgba(2, 132, 199, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                                color: isArrowActive ? '#fff' : '#94a3b8'
                              }}>
                                <ArrowRight size={13} strokeWidth={2.5} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Transfer Trail Summary (if transferred) */}
                    {b.transferHistory && b.transferHistory.length > 0 && (
                      <div style={{
                        marginTop: '0.25rem',
                        padding: '0.65rem 1rem',
                        background: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Truck size={14} color="#d97706" />
                          <span>
                            Custody dispatched from <strong style={{ color: '#0f172a' }}>{b.transferHistory[0].senderOrgName}</strong> to <strong style={{ color: '#0284c7' }}>{b.transferHistory[0].receiverOrgName}</strong>
                          </span>
                          <span style={{ color: '#64748b' }}>
                            • Seal: <code style={{ color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>{b.transferHistory[0].newSealId}</code>
                          </span>
                        </div>

                        {b.transferHistory[0].blockNumber && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                            <Cpu size={12} />
                            <span>Hardhat Block #{b.transferHistory[0].blockNumber}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                No active batches in the supply chain yet
              </h4>
              <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                maxWidth: '460px',
                margin: '0 auto 1.5rem',
                lineHeight: 1.6
              }}>
                Batches will appear here automatically with real-time visual custody pipeline transitions when manufacturers register batches via the <strong>Transport App</strong>.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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
                  <Building2 size={15} /> Authorise Organisations
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
                  <GitFork size={15} /> Configure Route Rules
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ledger & Infrastructure Underpinnings Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid #e2e8f0',
          padding: '1.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
        }}>
          {/* Blockchain Subsystem */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={16} /> Solidity Smart Contract (PharmaShield.sol)
              </span>
              <span className="badge badge-active">Chain 31337 Active</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.35rem' }}>
              Contract Address:
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '6px 10px',
              borderRadius: '6px',
              color: '#0f172a',
              wordBreak: 'break-all'
            }}>
              {health?.blockchain?.contractAddress || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.4rem' }}>
              Ledger Node: <code style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>http://127.0.0.1:8545</code>
            </div>
          </div>

          {/* Database Subsystem */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={16} /> MongoDB Atlas Production Cluster
              </span>
              <span className="badge badge-active">Operational</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#475569' }}>
              Database: <code style={{ color: '#0284c7', fontFamily: 'var(--font-mono)' }}>pharmashield</code>
            </p>
            <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.35rem' }}>
              Enforced unique schemas for zero duplicate batches, strict tamper seals, and immutable transition audit logs.
            </p>
          </div>

          {/* AI Vision Subsystem */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} /> AI Vision Verification Engine
              </span>
              <span className="badge badge-authority">Groq Qwen Vision</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#475569' }}>
              Vision Model: <code style={{ color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>qwen/qwen3.8-27b</code>
            </p>
            <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.35rem' }}>
              Zero pre-programmed database reliance: verifies visual packaging OCR directly against manufacturer-declared production details.
            </p>
          </div>
        </div>
      </div>

      {/* On-Chain Blockchain Ledger Audit Modal */}
      {auditBatchId && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem',
          margin: 0
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Cpu size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    Solidity Smart Contract Ledger Audit
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Verifying on-chain immutable records for Batch <strong style={{ color: '#0284c7', fontFamily: 'var(--font-mono)' }}>{auditBatchId}</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setAuditBatchId(null)}
                style={{ background: 'transparent', color: '#64748b', fontSize: '1.4rem', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {auditLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={28} className="spin" style={{ margin: '0 auto 1rem', color: '#06b6d4' }} />
                <p>Querying Ethereum Virtual Machine (EVM) contract logs...</p>
              </div>
            ) : auditError ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                color: '#fca5a5',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Failed to query on-chain ledger:</div>
                {auditError}
              </div>
            ) : auditData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* On-Chain Contract State */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #e2e8f0',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Current On-Chain Smart Contract State
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Contract Address:</span>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#0f172a', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {auditData.blockchain?.contractAddress}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: '#64748b' }}>Current Custody Holder (Ethereum Address):</span>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#059669', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {auditData.blockchain?.currentHolder || 'Not registered on chain'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Trusted Data Hash (Anchored on Chain):</span>
                    <div style={{ fontFamily: 'var(--font-mono)', color: '#7c3aed', fontSize: '0.75rem', wordBreak: 'break-all', marginTop: '2px' }}>
                      {auditData.blockchain?.trustedDataHash || auditData.trustedDataHash}
                    </div>
                  </div>
                </div>

                {/* Real Emitted Blockchain Events */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="#059669" />
                    Recorded Smart Contract Events ({auditData.blockchain?.events?.length || 0})
                  </div>

                  {auditData.blockchain?.events && auditData.blockchain.events.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {auditData.blockchain.events.map((ev, eIdx) => (
                        <div
                          key={eIdx}
                          style={{
                            background: '#ffffff',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid #e2e8f0',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              color: ev.event === 'BatchRegistered' ? '#1e40af' : '#92400e',
                              background: ev.event === 'BatchRegistered' ? '#eff6ff' : '#fffbeb',
                              border: `1px solid ${ev.event === 'BatchRegistered' ? '#bfdbfe' : '#fde68a'}`,
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}>
                              event {ev.event}
                            </span>

                            <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                              Hardhat Block #{ev.blockNumber}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: '#64748b', wordBreak: 'break-all' }}>
                            Tx Hash: <span style={{ fontFamily: 'var(--font-mono)', color: '#0f172a' }}>{ev.transactionHash}</span>
                          </div>

                          {/* Event Decoded Arguments */}
                          <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#334155',
                            marginTop: '0.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                          }}>
                            {Object.entries(ev.args || {}).map(([k, val]) => (
                              <div key={k} style={{ display: 'flex', gap: '6px' }}>
                                <span style={{ color: '#0284c7', fontWeight: 600 }}>{k}:</span>
                                <span style={{ wordBreak: 'break-all', color: '#0f172a' }}>{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: '1.5rem',
                      textAlign: 'center',
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      borderRadius: 'var(--radius-md)',
                      color: '#64748b',
                      fontSize: '0.8rem'
                    }}>
                      No historical events recorded for this batch.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                onClick={() => setAuditBatchId(null)}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  background: '#f1f5f9',
                  color: '#0f172a',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
