import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isModalOpen]);

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
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Authorized Organisations Registry
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#475569' }}>
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
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
          }}
        >
          <Plus size={18} /> Register New Organisation
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #e2e8f0',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
      }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #cbd5e1',
          padding: '0.5rem 0.9rem',
          minWidth: '280px',
        }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search by name, code, contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#0f172a',
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
                background: typeFilter === t ? '#eff6ff' : '#f1f5f9',
                color: typeFilter === t ? '#1d4ed8' : '#475569',
                border: typeFilter === t ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Organisations Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700 }}>Organisation</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>Type</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>Code</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>Contact Info</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>Address</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right', fontWeight: 700 }}>Actions</th>
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
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                          {org.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          ID: {org.id.substring(0, 10)}...
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        <span className={`badge ${getTypeBadgeClass(org.type)}`}>
                          {org.type}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#64748b' }}>
                        {org.code || '—'}
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        {org.contactPerson && (
                          <div style={{ color: '#334155', fontWeight: 600 }}>{org.contactPerson}</div>
                        )}
                        {org.contactEmail && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} /> {org.contactEmail}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1rem', color: '#64748b', maxWidth: '220px', fontSize: '0.8rem' }}>
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
      {isModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          margin: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem',
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '560px',
            padding: '2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Building2 size={24} color="#0284c7" />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
                  Register New Organisation
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', color: '#64748b', fontSize: '1.2rem', padding: '4px 8px', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Organisation Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter registered organization legal name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Organisation Role / Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#0f172a',
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
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Org Identifier Code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter short code (e.g. 3-6 uppercase letters)"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Registered Physical Facility Address
                </label>
                <input
                  type="text"
                  placeholder="Enter facility physical address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Primary Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Enter primary contact person"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Official Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="Enter official contact email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      color: '#0f172a',
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
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer'
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
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                    opacity: submitting ? 0.7 : 1,
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Creating in MongoDB...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
