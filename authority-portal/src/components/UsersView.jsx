import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  CheckCircle, 
  XCircle, 
  Key, 
  Building2, 
  ShieldCheck, 
  Lock,
  Mail,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function UsersView({ 
  users, 
  organizations, 
  onRefresh, 
  showToast 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newPassword, setNewPassword] = useState('PharmaShield@2026');
  const [submitting, setSubmitting] = useState(false);

  // Form State for User Creation
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState('Manufacturer Operator');

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!organizationId) {
      showToast('Please select an organisation to assign the user.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.createUser({
        fullName,
        username,
        email,
        password,
        organizationId,
        role,
        status: 'Active',
      });
      showToast(`User '${fullName}' (${username}) created successfully!`, 'success');
      setIsCreateModalOpen(false);
      resetCreateForm();
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateUserStatus(user.id, nextStatus);
      showToast(`User '${user.username}' is now ${nextStatus}`, 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to update user status', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    setSubmitting(true);
    try {
      await api.resetUserPassword(selectedUserForReset.id, newPassword);
      showToast(`Password reset successfully for '${selectedUserForReset.username}'`, 'success');
      setIsResetModalOpen(false);
      setSelectedUserForReset(null);
    } catch (err) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('Manufacturer Operator');
  };

  const filteredUsers = (users || []).filter(u => {
    const matchSearch = u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        u.organizationName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const getRoleBadgeStyle = (roleName) => {
    if (roleName.includes('Manufacturer')) return 'badge-manufacturer';
    if (roleName.includes('Distributor')) return 'badge-distributor';
    if (roleName.includes('Wholesaler')) return 'badge-wholesaler';
    if (roleName.includes('Retailer')) return 'badge-retailer';
    return 'badge-authority';
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            System Users & Role Governance
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Provision authenticated operators, enforce zero-trust identity, and assign organization roles.
          </p>
        </div>

        <button
          onClick={() => {
            if (organizations && organizations.length > 0 && !organizationId) {
              setOrganizationId(organizations[0].id);
            }
            setIsCreateModalOpen(true);
          }}
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
          <UserPlus size={18} /> Provision New User
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
            placeholder="Search by name, email, organization..."
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

        {/* Role Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['ALL', 'Authority', 'Manufacturer Operator', 'Distributor Operator', 'Wholesaler Operator', 'Retailer Operator'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                background: roleFilter === r ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-elevated)',
                color: roleFilter === r ? '#38bdf8' : 'var(--text-secondary)',
                border: roleFilter === r ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
              }}
            >
              {r.replace(' Operator', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
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
                <th style={{ padding: '0.9rem 1.25rem' }}>User Profile</th>
                <th style={{ padding: '0.9rem 1rem' }}>Assigned Organisation</th>
                <th style={{ padding: '0.9rem 1rem' }}>Role</th>
                <th style={{ padding: '0.9rem 1rem' }}>Status</th>
                <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map(u => {
                  const isActive = u.status === 'Active';
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                          {u.fullName || u.username}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>@{u.username}</span> • <span>{u.email}</span>
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>
                          {u.organizationName || '—'}
                        </div>
                        {u.organizationType && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Type: {u.organizationType}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        <span className={`badge ${getRoleBadgeStyle(u.role)}`}>
                          {u.role}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1rem' }}>
                        <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                          {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {u.status}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setSelectedUserForReset(u);
                              setIsResetModalOpen(true);
                            }}
                            title="Reset user password"
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Key size={13} /> Reset Pass
                          </button>

                          {/* Toggle Active Status */}
                          {u.role !== 'Authority' ? (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: isActive ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                color: isActive ? '#f43f5e' : '#10b981',
                                border: `1px solid ${isActive ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                              }}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Root
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found matching current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
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
                <UserPlus size={24} color="#06b6d4" />
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                  Provision User Account
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '1.2rem', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
                    Username (Unique) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="aarav_apex"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
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
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="aarav@apexpharma.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Assigned Organisation *
                  </label>
                  <select
                    value={organizationId}
                    onChange={(e) => {
                      setOrganizationId(e.target.value);
                      const org = organizations.find(o => o.id === e.target.value);
                      if (org) {
                        if (org.type === 'Manufacturer') setRole('Manufacturer Operator');
                        else if (org.type === 'Distributor') setRole('Distributor Operator');
                        else if (org.type === 'Wholesaler') setRole('Wholesaler Operator');
                        else if (org.type === 'Retailer') setRole('Retailer Operator');
                        else setRole('Authority');
                      }
                    }}
                    required
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
                    {organizations && organizations.length > 0 ? (
                      organizations.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.type})
                        </option>
                      ))
                    ) : (
                      <option value="">No registered organisations yet</option>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Assigned Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
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
                    <option value="Manufacturer Operator">Manufacturer Operator</option>
                    <option value="Distributor Operator">Distributor Operator</option>
                    <option value="Wholesaler Operator">Wholesaler Operator</option>
                    <option value="Retailer Operator">Retailer Operator</option>
                    <option value="Authority">Authority Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Initial Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
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
                  {submitting ? 'Creating User...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetModalOpen && selectedUserForReset && (
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
            maxWidth: '440px',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <Key size={22} color="#3b82f6" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                Reset User Password
              </h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Set a new temporary password for <strong>{selectedUserForReset.fullName}</strong> (@{selectedUserForReset.username}).
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  New Secure Password
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  style={{
                    padding: '0.6rem 1.1rem',
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
                    padding: '0.6rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
