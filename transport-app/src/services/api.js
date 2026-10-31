const TOKEN_KEY = 'pharmashield_transport_token';
const USER_KEY = 'pharmashield_transport_user';

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

  async getBatches(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/batches${qs ? `?${qs}` : ''}`);
  },

  async verifyBatchData(manufacturerInput, aiExtracted) {
    return request('/api/batches/verify', {
      method: 'POST',
      body: JSON.stringify({ manufacturerInput, aiExtracted }),
    });
  },

  async registerBatch(payload) {
    return request('/api/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async transferBatch(batchId, payload, optionalSealId) {
    let body = payload;
    if (typeof payload === 'string') {
      body = { receiverOrgId: payload, newSealId: optionalSealId };
    }
    return request(`/api/batches/${batchId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getOrganizations(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/organizations${qs ? `?${qs}` : ''}`);
  },

  async getSupplyChainRules() {
    return request('/api/supply-chain/rules');
  },

  async getBatchBlockchainAudit(batchId) {
    return request(`/api/batches/${batchId}/blockchain`);
  },

  async getIncomingDeliveries() {
    return request('/api/deliveries/incoming');
  },

  async verifyBatchStageScan(batchId, aiExtracted) {
    return request(`/api/batches/${batchId}/verify-scan`, {
      method: 'POST',
      body: JSON.stringify({ aiExtracted }),
    });
  },

  async receiveBatch(batchId, verification, newSealId) {
    return request(`/api/batches/${batchId}/receive`, {
      method: 'POST',
      body: JSON.stringify({ verification, newSealId }),
    });
  },

  async dispenseBatch(batchId, dispenseDetails) {
    return request(`/api/batches/${batchId}/dispense`, {
      method: 'POST',
      body: JSON.stringify(dispenseDetails),
    });
  },

  async extractMedicineImage(imageFile) {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch('/api/ai/extract', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to analyze medicine packaging');
    }
    return data;
  },
};
