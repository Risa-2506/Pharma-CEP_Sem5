import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle, 
  XCircle, 
  Filter, 
  Mail, 
  Phone, 
  MapPin, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';

export default function OrganizationsView({ 
  organizations, 
  onRefresh, 
  showToast 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('Manufacturer');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createOrganization({
        name,
        type,
        code: code || name.substring(0, 4).toUpperCase(),
        address,
        contactPerson,
        contactEmail,
        contactPhone,
        status: 'Active',
      });
      showToast(`Organisation '${name}' created successfully!`, 'success');
      setIsModalOpen(false);
      resetForm();
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create organization', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (org) => {
    const nextStatus = org.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateOrganizationStatus(org.id, nextStatus);
      showToast(`Organisation '${org.name}' is now ${nextStatus}`, 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Status update failed', 'error');
    }
  };

  const resetForm = () => {
    setName('');
    setType('Manufacturer');
    setCode('');
    setAddress('');
    setContactPerson('');
    setContactEmail('');
    setContactPhone('');
  };

  // Quick Preset Helper for testing the 4 standard organizations
  const fillPreset = (presetName, presetType, presetCode, presetAddress) => {
    setName(presetName);
    setType(presetType);
    setCode(presetCode);
    setAddress(presetAddress);
    setContactPerson(`${presetName.split(' ')[0]} Admin`);
    setContactEmail(`ops@${presetName.toLowerCase().replace(/[^a-z]/g, '')}.com`);
    setContactPhone('+91 98765 43210');
  };

  const filteredOrgs = (organizations || []).filter(org => {
    const matchSearch = org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        org.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        org.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'ALL' || org.type === typeFilter;
    return matchSearch && matchType;
  });

  const getTypeBadgeClass = (orgType) => {
    switch (orgType) {
      case 'Manufacturer': return 'badge-manufacturer';
      case 'Distributor': return 'badge-distributor';
      case 'Wholesaler': return 'badge-wholesaler';
      case 'Retailer': return 'badge-retailer';
      default: return 'badge-authority';
    }
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* View Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Authorized Organisations Registry
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Register, authorize, and govern licensed pharmaceutical supply chain participants.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 700,
            boxShadow: '0 4px 15px rgba(6, 182, 212, 0.35)',
          }}
        >
          <Plus size={18} /> Register New Organisation
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '0.5rem 0.9rem',
          minWidth: '280px',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by name, code, contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '0.85rem',
              width: '100%',
            }}
          />
        </div>

        {/* Type Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'Manufacturer', 'Distributor', 'Wholesaler', 'Retailer', 'Authority'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                background: typeFilter === t ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-elevated)',
                color: typeFilter === t ? '#38bdf8' : 'var(--text-secondary)',
                border: typeFilter === t ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Organisations Table */}
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.9rem 1.25rem' }}>Organisation</th>
                <th style={{ padding: '0.9rem 1rem' }}>Type</th>
                <th style={{ padding: '0.9rem 1rem' }}>Code</th>
                <th style={{ padding: '0.9rem 1rem' }}>Contact Info</th>
                <th style={{ padding: '0.9rem 1rem' }}>Address</th>
                <th style={{ padding: '0.9rem 1rem' }}>Status</th>
                <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.length > 0 ? (
                filteredOrgs.map(org => {
                  const isActive = org.status === 'Active';
                  return (
                    <tr
                      key={org.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                          {org.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ID: {org.id.substring(0, 10)}...
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        <span className={`badge ${getTypeBadgeClass(org.type)}`}>
                          {org.type}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#94a3b8' }}>
                        {org.code || '—'}
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        {org.contactPerson && (
                          <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{org.contactPerson}</div>
                        )}
                        {org.contactEmail && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} /> {org.contactEmail}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1rem', color: 'var(--text-secondary)', maxWidth: '220px', fontSize: '0.8rem' }}>
                        {org.address || '—'}
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                          {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {org.status}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        {org.type !== 'Authority' ? (
                          <button
                            onClick={() => handleToggleStatus(org)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: isActive ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              color: isActive ? '#f43f5e' : '#10b981',
                              border: `1px solid ${isActive ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                            }}
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Permanent
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No organisations found matching current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Organization Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '560px',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Building2 size={24} color="#06b6d4" />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                  Register New Organisation
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.2rem', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Presets for Demo Testing */}
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Test Templates:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fillPreset('Apex Pharma Pvt. Ltd.', 'Manufacturer', 'APEX', 'MIDC Industrial Area, Pune, Maharashtra')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', border: '1px solid rgba(6, 182, 212, 0.3)' }}
                >
                  + Apex Pharma (Manufacturer)
                </button>
                <button
                  type="button"
                  onClick={() => fillPreset('ABC Distributors', 'Distributor', 'ABCD', 'Sector 18 Logistics Hub, Gurgaon, Haryana')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                >
                  + ABC Distributors (Distributor)
                </button>
                <button
                  type="button"
                  onClick={() => fillPreset('XYZ Wholesale', 'Wholesaler', 'XYZW', 'Pharma Trade Centre, Ahmedabad, Gujarat')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                >
                  + XYZ Wholesale (Wholesaler)
                </button>
                <button
                  type="button"
                  onClick={() => fillPreset('HealthPlus Pharmacy', 'Retailer', 'HPLU', 'Bandra West, Mumbai, Maharashtra')}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                >
                  + HealthPlus Pharmacy (Retailer)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Organisation Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Pharma Pvt. Ltd."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Organisation Role / Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Wholesaler">Wholesaler</option>
                    <option value="Retailer">Retailer</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Org Identifier Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. APEX"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Registered Physical Facility Address
                </label>
                <input
                  type="text"
                  placeholder="Facility location, State, Country"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Primary Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aarav Sharma"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Official Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="regulatory@apexpharma.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Creating in MongoDB...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
