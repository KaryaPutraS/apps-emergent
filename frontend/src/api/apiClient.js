import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API_BASE = `${BACKEND_URL}/api`;

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Token management
let authToken = localStorage.getItem('chatbot_token') || null;

export const setToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('chatbot_token', token);
  } else {
    localStorage.removeItem('chatbot_token');
  }
};

export const getToken = () => authToken;

export const clearToken = () => {
  authToken = null;
  localStorage.removeItem('chatbot_token');
};

// Interceptor to add auth header
apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Interceptor to handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH
// ============================================================

export const login = async (username, password) => {
  const { data } = await apiClient.post('/auth/login', { username, password });
  if (data.success && data.token) {
    setToken(data.token);
  }
  return data;
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (e) { /* ignore */ }
  clearToken();
};

export const checkSession = async () => {
  const { data } = await apiClient.get('/auth/check');
  return data;
};

// ============================================================
// DASHBOARD
// ============================================================

export const getDashboardStats = async () => {
  const { data } = await apiClient.get('/dashboard/stats');
  return data;
};

export const getDashboardChart = async () => {
  const { data } = await apiClient.get('/dashboard/chart');
  return data;
};

// ============================================================
// CONFIG
// ============================================================

export const getConfig = async () => {
  const { data } = await apiClient.get('/config');
  return data;
};

export const updateConfig = async (updates) => {
  const { data } = await apiClient.put('/config', { updates });
  return data;
};

export const getAIAgentConfig = async () => {
  const { data } = await apiClient.get('/config/ai-agent');
  return data;
};

export const updateAIAgentConfig = async (config) => {
  const { data } = await apiClient.put('/config/ai-agent', config);
  return data;
};

// ============================================================
// LICENSE
// ============================================================

export const getLicense = async () => {
  const { data } = await apiClient.get('/license');
  return data;
};

export const activateLicense = async (licenseKey) => {
  const { data } = await apiClient.post('/license/activate', { licenseKey });
  return data;
};

export const clearLicense = async () => {
  const { data } = await apiClient.delete('/license');
  return data;
};

// ============================================================
// USERS
// ============================================================

export const getUsers = async () => {
  const { data } = await apiClient.get('/users');
  return data;
};

export const getUserStats = async () => {
  const { data } = await apiClient.get('/users/stats');
  return data;
};

export const createUser = async (user) => {
  const { data } = await apiClient.post('/users', user);
  return data;
};

export const updateUser = async (userId, updates) => {
  const { data } = await apiClient.put(`/users/${userId}`, updates);
  return data;
};

export const deleteUser = async (userId) => {
  const { data } = await apiClient.delete(`/users/${userId}`);
  return data;
};

export const toggleUser = async (userId) => {
  const { data } = await apiClient.put(`/users/${userId}/toggle`);
  return data;
};

export const regenerateWebhookToken = async (userId) => {
  const { data } = await apiClient.post(`/users/${userId}/regenerate-token`);
  return data;
};

export const getAllUserActivity = async (userId = null, limit = 100) => {
  const params = { limit };
  if (userId) params.user_id = userId;
  const { data } = await apiClient.get('/admin/user-activity', { params });
  return data;
};

// ============================================================
// RULES
// ============================================================

export const getRules = async () => {
  const { data } = await apiClient.get('/rules');
  return data;
};

export const saveRule = async (rule) => {
  const { data } = await apiClient.post('/rules', rule);
  return data;
};

export const deleteRule = async (id) => {
  const { data } = await apiClient.delete(`/rules/${id}`);
  return data;
};

export const toggleRule = async (id) => {
  const { data } = await apiClient.put(`/rules/${id}/toggle`);
  return data;
};

// ============================================================
// KNOWLEDGE
// ============================================================

export const getKnowledge = async () => {
  const { data } = await apiClient.get('/knowledge');
  return data;
};

export const saveKnowledge = async (item) => {
  const { data } = await apiClient.post('/knowledge', item);
  return data;
};

export const deleteKnowledge = async (id) => {
  const { data } = await apiClient.delete(`/knowledge/${id}`);
  return data;
};

// ============================================================
// TEMPLATES
// ============================================================

export const getTemplates = async () => {
  const { data } = await apiClient.get('/templates');
  return data;
};

export const saveTemplate = async (item) => {
  const { data } = await apiClient.post('/templates', item);
  return data;
};

export const deleteTemplate = async (id) => {
  const { data } = await apiClient.delete(`/templates/${id}`);
  return data;
};

// ============================================================
// CONTACTS
// ============================================================

export const getContacts = async (search = '') => {
  const { data } = await apiClient.get('/contacts', { params: { search } });
  return data;
};

export const updateContact = async (chatId, updates) => {
  const { data } = await apiClient.put(`/contacts/${encodeURIComponent(chatId)}`, updates);
  return data;
};

export const deleteContact = async (chatId) => {
  const { data } = await apiClient.delete(`/contacts/${encodeURIComponent(chatId)}`);
  return data;
};

// ============================================================
// MESSAGES
// ============================================================

export const getMessages = async (limit = 50) => {
  const { data } = await apiClient.get('/messages', { params: { limit } });
  return data;
};

// ============================================================
// BROADCAST
// ============================================================

export const checkBroadcast = async (params) => {
  const { data } = await apiClient.post('/broadcast/check', params);
  return data;
};

export const sendBroadcast = async (params) => {
  const { data } = await apiClient.post('/broadcast/send', params);
  return data;
};

// ============================================================
// LOGS
// ============================================================

export const getLogs = async (limit = 50) => {
  const { data } = await apiClient.get('/logs', { params: { limit } });
  return data;
};

// ============================================================
// TEST CENTER
// ============================================================

export const testRule = async (message) => {
  const { data } = await apiClient.post('/test/rule', { message });
  return data;
};

export const testKnowledge = async (message) => {
  const { data } = await apiClient.post('/test/knowledge', { message });
  return data;
};

export const testFullFlow = async (message) => {
  const { data } = await apiClient.post('/test/full-flow', { message });
  return data;
};

// ============================================================
// DOCUMENTATION
// ============================================================

export const getAllDocs = async () => {
  const { data } = await apiClient.get('/docs');
  return data;
};

export const getDoc = async (slug) => {
  const { data } = await apiClient.get(`/docs/${slug}`);
  return data;
};

export const updateDoc = async (slug, docPage) => {
  const { data } = await apiClient.put(`/docs/${slug}`, docPage);
  return data;
};

export const createDoc = async (slug, title) => {
  const { data } = await apiClient.post('/docs', { slug, title });
  return data;
};

export const deleteDoc = async (slug) => {
  const { data } = await apiClient.delete(`/docs/${slug}`);
  return data;
};

export const uploadDocImage = async (dataUrl) => {
  const { data } = await apiClient.post('/docs/upload-image', { dataUrl });
  return data;
};

// ============================================================
// RESET
// ============================================================

export const resetConfig = async () => {
  const { data } = await apiClient.post('/reset/config');
  return data;
};

export const resetDashboard = async () => {
  const { data } = await apiClient.post('/reset/dashboard');
  return data;
};

export const resetMessages = async () => {
  const { data } = await apiClient.post('/reset/messages');
  return data;
};

export const resetContacts = async () => {
  const { data } = await apiClient.post('/reset/contacts');
  return data;
};

// ============================================================
// PASSWORD
// ============================================================

export const changePassword = async (currentPassword, newPassword, confirmPassword) => {
  const { data } = await apiClient.post('/auth/change-password', {
    currentPassword,
    newPassword,
    confirmPassword,
  });
  if (data.token) setToken(data.token);
  return data;
};

// ============================================================
// AI SETUP (real API via backend proxy)
// ============================================================

export const aiSetupChat = async (message, history = []) => {
  const { data } = await apiClient.post('/ai-setup/chat', { message, history });
  return data;
};

export default apiClient;
