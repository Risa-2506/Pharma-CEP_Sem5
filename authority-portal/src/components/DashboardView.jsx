import React, { useState, useEffect } from 'react';
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
  onRefresh, 
  loading,
  setActiveTab 
}) {
  const [auditBatchId, setAuditBatchId] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [rules, setRules] = useState(null);

  // Load supply chain rules to know configured partners per stage
  useEffect(() => {
    async function loadRules() {
      try {
        const res = await api.getSupplyChainRules();
        if (res.rule) setRules(res.rule);
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
      if (currentStage === 'Retailer') {
        return { completed: true, active: true, inTransit: false };
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

    if (stageKey === 'Distributor') {
      if (batch.stage === 'Distributor' || batch.status === 'In Transit') {
        return batch.currentHolderName;
      }
      // Check transition in rules
      const rels = rules?.relationships || [];
      const distRel = rels.find(r => r.type === 'Distributor');
      if (distRel?.orgName) return distRel.orgName;
      const trans = rules?.allowedTransitions || [];
      const distTrans = trans.find(t => t.to === 'Distributor' || t.toOrg);
      return distTrans?.toOrg || 'Authorized Distributor';
    }

    if (stageKey === 'Wholesaler') {
      if (batch.stage === 'Wholesaler') return batch.currentHolderName;
      const rels = rules?.relationships || [];
      const whRel = rels.find(r => r.type === 'Wholesaler');
      if (whRel?.orgName) return whRel.orgName;
      return 'Authorized Wholesaler';
    }

    if (stageKey === 'Retailer') {
      if (batch.stage === 'Retailer') return batch.currentHolderName;
      const rels = rules?.relationships || [];
      const retRel = rels.find(r => r.type === 'Retailer');
      if (retRel?.orgName) return retRel.orgName;
      return 'Authorized Retailer / Pharmacy';
    }

    return stageKey;
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
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Regulatory Authority Monitoring Dashboard
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
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
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 8px 24px -6px rgba(0,0,0,0.4)`,
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

      {/* Main Section: Visual Batch Custody Stepper Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1.5rem',
      }}>
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitFork size={20} color="#06b6d4" /> Visual Batch Custody Pipeline Monitor
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Live end-to-end stage verification: boxes highlight upon stage completion and disable until reached.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Completed / Verified
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> In Transit
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border-medium)' }} /> Pending / Disabled
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
                      background: 'rgba(15, 23, 42, 0.65)',
                      borderRadius: 'var(--radius-xl)',
                      border: isBlocked 
                        ? '1px solid rgba(239, 68, 68, 0.5)' 
                        : '1px solid var(--border-medium)',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
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
                      borderBottom: '1px solid var(--border-subtle)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Batch Identification
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                            {b.batchId}
                          </div>
                        </div>

                        <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Medicine & Formulation</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{b.medicineName}</div>
                        </div>

                        <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quantity / Seal</div>
                          <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>
                            {b.quantity?.toLocaleString() || '10,000'} units | <code style={{ color: '#c084fc', fontFamily: 'var(--font-mono)' }}>{b.sealId}</code>
                          </div>
                        </div>
                      </div>

                      {/* Badges & Blockchain Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-active" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> {b.verificationStatus || 'AI Verified'}
                        </span>

                        {isBlocked ? (
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
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
                            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(37, 99, 235, 0.25))',
                            color: '#38bdf8',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            padding: '0.45rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 10px rgba(6, 182, 212, 0.2)'
                          }}
                        >
                          <Cpu size={14} color="#38bdf8" /> On-Chain Ledger Audit
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
                        let boxBorder = '1px dashed var(--border-subtle)';
                        let boxBg = 'rgba(15, 23, 42, 0.4)';
                        let iconColor = '#64748b';
                        let textColor = '#64748b';
                        let subTextColor = '#475569';
                        let badgeBg = 'rgba(100, 116, 139, 0.15)';
                        let badgeColor = '#64748b';
                        let badgeText = 'Pending';
                        let opacity = 0.45;

                        if (status.completed && !status.inTransit) {
                          boxBorder = '1px solid rgba(16, 185, 129, 0.6)';
                          boxBg = 'rgba(16, 185, 129, 0.08)';
                          iconColor = '#10b981';
                          textColor = '#fff';
                          subTextColor = '#94a3b8';
                          badgeBg = 'rgba(16, 185, 129, 0.2)';
                          badgeColor = '#10b981';
                          badgeText = stg.key === 'Manufacturer' ? 'Produced & Baseline Anchored' : 'Custody Verified';
                          opacity = 1;
                        } else if (status.inTransit) {
                          boxBorder = '1px solid rgba(245, 158, 11, 0.6)';
                          boxBg = 'rgba(245, 158, 11, 0.1)';
                          iconColor = '#f59e0b';
                          textColor = '#fff';
                          subTextColor = '#fbbf24';
                          badgeBg = 'rgba(245, 158, 11, 0.25)';
                          badgeColor = '#fbbf24';
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
                              boxShadow: status.completed ? '0 0 20px rgba(16, 185, 129, 0.1)' : 'none',
                              minHeight: '135px',
                              justifyContent: 'space-between',
                            }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: status.completed ? '#10b981' : (status.inTransit ? '#f59e0b' : 'var(--text-muted)'),
                                    letterSpacing: '0.04em'
                                  }}>
                                    Stage {sIdx + 1}: {stg.label}
                                  </span>
                                  <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: status.completed 
                                      ? 'rgba(16, 185, 129, 0.2)' 
                                      : (status.inTransit ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)'),
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
                                background: isArrowActive ? '#0284c7' : 'var(--bg-card)',
                                border: `1px solid ${isArrowActive ? '#38bdf8' : 'var(--border-subtle)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isArrowActive ? '0 0 10px rgba(56, 189, 248, 0.5)' : 'none',
                                color: isArrowActive ? '#fff' : 'var(--text-muted)'
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
                        background: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Truck size={14} color="#f59e0b" />
                          <span>
                            Custody dispatched from <strong style={{ color: '#fff' }}>{b.transferHistory[0].senderOrgName}</strong> to <strong style={{ color: '#38bdf8' }}>{b.transferHistory[0].receiverOrgName}</strong>
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            • Seal: <code style={{ color: '#c084fc', fontFamily: 'var(--font-mono)' }}>{b.transferHistory[0].newSealId}</code>
                          </span>
                        </div>

                        {b.transferHistory[0].blockNumber && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#10b981' }}>
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
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem'
        }}>
          {/* Blockchain Subsystem */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={16} /> Solidity Smart Contract (PharmaShield.sol)
              </span>
              <span className="badge badge-active">Chain 31337 Active</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Contract Address:
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '6px 10px',
              borderRadius: '4px',
              color: '#e2e8f0',
              wordBreak: 'break-all'
            }}>
              {health?.blockchain?.contractAddress || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Ledger Node: <code style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>http://127.0.0.1:8545</code>
            </div>
          </div>

          {/* Database Subsystem */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={16} /> MongoDB Atlas Production Cluster
              </span>
              <span className="badge badge-active">Operational</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Database: <code style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>pharmashield</code>
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Enforced unique schemas for zero duplicate batches, strict tamper seals, and immutable transition audit logs.
            </p>
          </div>

          {/* AI Vision Subsystem */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} /> AI Vision Verification Engine
              </span>
              <span className="badge badge-authority">Groq Qwen Vision</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Vision Model: <code style={{ color: '#c084fc', fontFamily: 'var(--font-mono)' }}>qwen/qwen3.8-27b</code>
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Zero pre-programmed database reliance: verifies visual packaging OCR directly against manufacturer-declared production details.
            </p>
          </div>
        </div>
      </div>

      {/* On-Chain Blockchain Ledger Audit Modal */}
      {auditBatchId && (
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
          zIndex: 120,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-lg)',
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
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                    Solidity Smart Contract Ledger Audit
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Verifying on-chain immutable records for Batch <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{auditBatchId}</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setAuditBatchId(null)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.4rem', padding: '4px 8px' }}
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
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Current On-Chain Smart Contract State
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Contract Address:</span>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {auditData.blockchain?.contractAddress}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Current Custody Holder (Ethereum Address):</span>
                      <div style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {auditData.blockchain?.currentHolder || 'Not registered on chain'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Trusted Data Hash (Anchored on Chain):</span>
                    <div style={{ fontFamily: 'var(--font-mono)', color: '#c084fc', fontSize: '0.75rem', wordBreak: 'break-all', marginTop: '2px' }}>
                      {auditData.blockchain?.trustedDataHash || auditData.trustedDataHash}
                    </div>
                  </div>
                </div>

                {/* Real Emitted Blockchain Events */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="#10b981" />
                    Recorded Smart Contract Events ({auditData.blockchain?.events?.length || 0})
                  </div>

                  {auditData.blockchain?.events && auditData.blockchain.events.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {auditData.blockchain.events.map((ev, eIdx) => (
                        <div
                          key={eIdx}
                          style={{
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-medium)',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              color: ev.event === 'BatchRegistered' ? '#38bdf8' : '#fbbf24',
                              background: ev.event === 'BatchRegistered' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}>
                              event {ev.event}
                            </span>

                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                              Hardhat Block #{ev.blockNumber}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                            Tx Hash: <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{ev.transactionHash}</span>
                          </div>

                          {/* Event Decoded Arguments */}
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.35)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#e2e8f0',
                            marginTop: '0.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                          }}>
                            {Object.entries(ev.args || {}).map(([k, val]) => (
                              <div key={k} style={{ display: 'flex', gap: '6px' }}>
                                <span style={{ color: '#06b6d4' }}>{k}:</span>
                                <span style={{ wordBreak: 'break-all' }}>{String(val)}</span>
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
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem'
                    }}>
                      No historical events recorded for this batch.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button
                onClick={() => setAuditBatchId(null)}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-medium)',
                }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
