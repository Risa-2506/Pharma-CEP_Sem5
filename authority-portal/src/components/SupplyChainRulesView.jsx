import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  ArrowRight, 
  Save, 
  CheckCircle2, 
  ShieldAlert, 
  Building2, 
  Layers, 
  Info,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function SupplyChainRulesView({ 
  organizations, 
  rules, 
  onRefresh, 
  showToast 
}) {
  const [routeName, setRouteName] = useState('Standard National Distribution Network');
  const [manufacturerId, setManufacturerId] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [wholesalerId, setWholesalerId] = useState('');
  const [retailerId, setRetailerId] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync with loaded rules
  useEffect(() => {
    if (rules?.relationships && rules.relationships.length > 0) {
      const rels = rules.relationships;
      const m = rels.find(r => r.stage === 'Manufacturer')?.orgId || '';
      const d = rels.find(r => r.stage === 'Distributor')?.orgId || '';
      const w = rels.find(r => r.stage === 'Wholesaler')?.orgId || '';
      const ret = rels.find(r => r.stage === 'Retailer')?.orgId || '';
      if (m) setManufacturerId(m);
      if (d) setDistributorId(d);
      if (w) setWholesalerId(w);
      if (ret) setRetailerId(ret);
    } else if (organizations && organizations.length > 0) {
      // Auto-populate first matching org of each type
      const m = organizations.find(o => o.type === 'Manufacturer');
      const d = organizations.find(o => o.type === 'Distributor');
      const w = organizations.find(o => o.type === 'Wholesaler');
      const ret = organizations.find(o => o.type === 'Retailer');
      if (m && !manufacturerId) setManufacturerId(m.id);
      if (d && !distributorId) setDistributorId(d.id);
      if (w && !wholesalerId) setWholesalerId(w.id);
      if (ret && !retailerId) setRetailerId(ret.id);
    }
  }, [rules, organizations]);

  const manufacturers = (organizations || []).filter(o => o.type === 'Manufacturer');
  const distributors = (organizations || []).filter(o => o.type === 'Distributor');
  const wholesalers = (organizations || []).filter(o => o.type === 'Wholesaler');
  const retailers = (organizations || []).filter(o => o.type === 'Retailer');

  const handleSaveRules = async (e) => {
    e.preventDefault();
    setSaving(true);

    const mOrg = organizations.find(o => o.id === manufacturerId);
    const dOrg = organizations.find(o => o.id === distributorId);
    const wOrg = organizations.find(o => o.id === wholesalerId);
    const rOrg = organizations.find(o => o.id === retailerId);

    const relationships = [
      { stage: 'Manufacturer', orgId: manufacturerId, orgName: mOrg?.name || 'Unassigned', orgCode: mOrg?.code || '' },
      { stage: 'Distributor', orgId: distributorId, orgName: dOrg?.name || 'Unassigned', orgCode: dOrg?.code || '' },
      { stage: 'Wholesaler', orgId: wholesalerId, orgName: wOrg?.name || 'Unassigned', orgCode: wOrg?.code || '' },
      { stage: 'Retailer', orgId: retailerId, orgName: rOrg?.name || 'Unassigned', orgCode: rOrg?.code || '' },
    ];

    const allowedTransitions = [
      { from: 'Manufacturer', to: 'Distributor', fromOrg: mOrg?.name, toOrg: dOrg?.name },
      { from: 'Distributor', to: 'Wholesaler', fromOrg: dOrg?.name, toOrg: wOrg?.name },
      { from: 'Wholesaler', to: 'Retailer', fromOrg: wOrg?.name, toOrg: rOrg?.name },
    ];

    try {
      await api.updateSupplyChainRules({
        name: routeName,
        relationships,
        allowedTransitions,
        stages: [
          { stage: 'Manufacturer', order: 1, description: 'Batch registration, packaging & initial AI verification' },
          { stage: 'Distributor', order: 2, description: 'Bulk receiving, scan verification & onward dispatch' },
          { stage: 'Wholesaler', order: 3, description: 'Regional transit hub receiving & verification' },
          { stage: 'Retailer', order: 4, description: 'Final pharmacy point-of-dispense verification' },
        ],
      });
      showToast('Authorised supply chain route configuration saved to MongoDB!', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to save supply chain rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getOrgName = (id) => {
    return organizations.find(o => o.id === id)?.name || 'Select Organisation';
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Authorized Supply Chain Routing & Stage Rules
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#475569' }}>
          Define mandatory custody transitions and enforce legitimate participant relationships. Transfers violating this route trigger fraud alerts.
        </p>
      </div>

      {/* Visual Pipeline Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} color="#0284c7" /> Authorised Custody Pipeline
          </h3>
          <span className="badge badge-active">Mandatory Route Order</span>
        </div>

        {/* 4 Pipeline Stages in visual horizontal flow */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          position: 'relative'
        }}>
          {[
            {
              order: '01',
              stage: 'Manufacturer',
              assigned: getOrgName(manufacturerId),
              badgeClass: 'badge-manufacturer',
              desc: 'Batch creation, medicine image scan & trusted baseline generation'
            },
            {
              order: '02',
              stage: 'Distributor',
              assigned: getOrgName(distributorId),
              badgeClass: 'badge-distributor',
              desc: 'Bulk custody receipt, seal check & AI package re-verification'
            },
            {
              order: '03',
              stage: 'Wholesaler',
              assigned: getOrgName(wholesalerId),
              badgeClass: 'badge-wholesaler',
              desc: 'Regional warehouse scan, hash comparison & local allocation'
            },
            {
              order: '04',
              stage: 'Retailer',
              assigned: getOrgName(retailerId),
              badgeClass: 'badge-retailer',
              desc: 'Pharmacy dispense verification & consumer counterfeit shield'
            },
          ].map((step, idx) => (
            <div
              key={idx}
              style={{
                background: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #e2e8f0',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  STAGE {step.order}
                </span>
                <span className={`badge ${step.badgeClass}`}>
                  {step.stage}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.2rem' }}>
                  Authorised Organisation:
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  {step.assigned}
                </div>
              </div>

              <p style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Route Mapping Configuration Form */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <GitFork size={22} color="#0284c7" />
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
              Map Organisation Supply Chain Authorisations
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#475569' }}>
              Configure exactly which registered licensed organisations are authorized to hand over batches to one another.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveRules} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              Route Rule Name
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--radius-sm)',
                padding: '0.7rem 0.9rem',
                color: '#0f172a',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem'
          }}>
            {/* Manufacturer Selector */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.5rem' }}>
                1. Authorised Manufacturer
              </label>
              <select
                value={manufacturerId}
                onChange={(e) => setManufacturerId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Choose Manufacturer --</option>
                {manufacturers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                ))}
              </select>
            </div>

            {/* Distributor Selector */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#4338ca', marginBottom: '0.5rem' }}>
                2. Authorised Distributor
              </label>
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Choose Distributor --</option>
                {distributors.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            {/* Wholesaler Selector */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#b45309', marginBottom: '0.5rem' }}>
                3. Authorised Wholesaler
              </label>
              <select
                value={wholesalerId}
                onChange={(e) => setWholesalerId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Choose Wholesaler --</option>
                {wholesalers.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* Retailer Selector */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#047857', marginBottom: '0.5rem' }}>
                4. Authorised Retailer / Pharmacy
              </label>
              <select
                value={retailerId}
                onChange={(e) => setRetailerId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Choose Retailer --</option>
                {retailers.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
              <Info size={15} color="#0284c7" />
              <span>
                Saved routes are enforced by the backend API and logged on the audit ledger.
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.6rem',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Save size={18} />
              {saving ? 'Saving to MongoDB...' : 'Save Authorized Supply Chain Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
