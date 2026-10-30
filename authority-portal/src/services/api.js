const TOKEN_KEY = 'pharmashield_auth_token';
const USER_KEY = 'pharmashield_auth_user';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Unified fetch wrapper
async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
      clearAuth();
      window.dispatchEvent(new CustomEvent('pharmashield:session_expired'));
    }
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  async login(username, password) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.token) {
      setAuthToken(res.token);
      setStoredUser(res.user);
    }
    return res;
  },

  async getMe() {
    return request('/api/auth/me');
  },

  logout() {
    clearAuth();
  },

  // Health
  async getHealth() {
    return request('/api/health');
  },

  // Organizations
  async getOrganizations(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/organizations${qs ? `?${qs}` : ''}`);
  },

  async createOrganization(payload) {
    return request('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateOrganizationStatus(orgId, status) {
    return request(`/api/organizations/${orgId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Users
  async getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/users${qs ? `?${qs}` : ''}`);
  },

  async createUser(payload) {
    return request('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateUserStatus(userId, status) {
    return request(`/api/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async resetUserPassword(userId, newPassword) {
    return request(`/api/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },

  // Supply Chain Rules
  async getSupplyChainRules() {
    return request('/api/supply-chain/rules');
  },

  async updateSupplyChainRules(payload) {
    return request('/api/supply-chain/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Batches & Dashboard
  async getBatchSummary() {
    return request('/api/batches/summary');
  },

  async getBatches(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/batches${qs ? `?${qs}` : ''}`);
  },

  async getBatchBlockchainAudit(batchId) {
    return request(`/api/batches/${batchId}/blockchain`);
  },
};
