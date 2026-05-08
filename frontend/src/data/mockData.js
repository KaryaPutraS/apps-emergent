// Mock data for SatroAI ChatBot Manager Dashboard

export const mockStats = {
  totalMessages: 1247,
  totalContacts: 89,
  activeRules: 12,
  aiCalls: 456,
  tokensUsed: 125890,
  botActive: true,
  uptime: '99.8%',
  avgResponseTime: '1.2s'
};

export const mockChartData = [
  { date: '2025-07-01', messagesIn: 45, messagesOut: 42, rulesMatched: 18, aiCalls: 24 },
  { date: '2025-07-02', messagesIn: 62, messagesOut: 58, rulesMatched: 25, aiCalls: 33 },
  { date: '2025-07-03', messagesIn: 38, messagesOut: 35, rulesMatched: 15, aiCalls: 20 },
  { date: '2025-07-04', messagesIn: 71, messagesOut: 68, rulesMatched: 30, aiCalls: 38 },
  { date: '2025-07-05', messagesIn: 55, messagesOut: 51, rulesMatched: 22, aiCalls: 29 },
  { date: '2025-07-06', messagesIn: 49, messagesOut: 46, rulesMatched: 19, aiCalls: 27 },
  { date: '2025-07-07', messagesIn: 83, messagesOut: 79, rulesMatched: 35, aiCalls: 44 },
];

export const mockLicense = {
  valid: true,
  status: 'active',
  licenseKey: 'SATRO-CHATBOT-ABCD12',
  customerName: 'PT Maju Bersama',
  planName: 'Professional',
  expiresAt: '2026-07-15',
  maxActivations: 3,
  instanceId: 'inst-abc123',
};

export const mockConfig = {
  wahaUrl: 'https://waha.example.com',
  wahaSession: 'default',
  hasWahaApiKey: true,
  aiProvider: 'GEMINI',
  aiModel: 'gemini-2.0-flash',
  hasAiApiKey: true,
  ollamaUrl: '',
  systemPrompt: 'Kamu adalah "Mbak Sari", customer service ramah dari Toko Kopi Nusantara. Tugas kamu menjawab pertanyaan pelanggan dengan friendly, singkat, dan informatif.\n\nATURAN PENTING:\n1. Selalu balas dalam Bahasa Indonesia santai\n2. Maksimal 3 kalimat per balasan\n3. Jika tidak tahu jawabannya, arahkan ke kontak langsung',
  businessInfo: 'Nama Toko: Toko Kopi Nusantara\nAlamat: Jl. Sudirman No. 123, Jakarta\nJam Buka: Senin-Minggu, 08:00 - 21:00\nTelepon: 0812-3456-7890\nInstagram: @kopinusantara\n\nMENU:\n- Espresso: 18k\n- Americano: 22k\n- Latte: 28k\n\nPEMBAYARAN: Cash, QRIS, Transfer',
  aiTemperature: 0.7,
  aiMaxTokens: 500,
  memoryLimit: 10,
  memoryTimeoutMinutes: 30,
  ruleAiEnabled: true,
  isBotActive: true,
  workingHoursEnabled: false,
  workingHoursStart: '08:00',
  workingHoursEnd: '21:00',
  offlineMessage: 'Halo kak, saat ini kami sudah tutup. Kami buka lagi besok jam 08:00.',
  typingSimulation: true,
  responseDelayMs: 2000,
  rateLimitPerMinute: 15,
  maxIncomingMessageChars: 2000,
  broadcastDailyLimit: 100,
  broadcastBatchSize: 10,
  defaultRuleResponseMode: 'direct',
  logRetentionDays: 30,
  messageRetentionDays: 90,
};

export const mockRules = [
  { id: '1', priority: 1, name: 'Greeting', triggerType: 'contains', triggerValue: 'halo|hai|hello|hi|hey', response: 'Halo kak! Selamat datang di Toko Kopi Nusantara. Ada yang bisa kami bantu?', isActive: true, hitCount: 245, responseMode: 'direct', imageUrl: '', imageCaption: '' },
  { id: '2', priority: 2, name: 'Menu', triggerType: 'contains', triggerValue: 'menu|daftar|harga|price', response: 'Berikut menu kami:\n- Espresso: 18k\n- Americano: 22k\n- Latte: 28k\n- Cappuccino: 28k', isActive: true, hitCount: 189, responseMode: 'ai_polish', imageUrl: '', imageCaption: '' },
  { id: '3', priority: 3, name: 'Promo', triggerType: 'contains', triggerValue: 'promo|diskon|sale', response: 'Promo bulan ini: Beli 2 gratis 1 untuk semua minuman espresso-based!', isActive: true, hitCount: 92, responseMode: 'direct', imageUrl: 'https://example.com/promo.jpg', imageCaption: 'Promo Juli 2025' },
  { id: '4', priority: 4, name: 'Jam Buka', triggerType: 'contains', triggerValue: 'buka|tutup|jam|operasional', response: 'Kami buka setiap hari, Senin-Minggu jam 08:00 - 21:00.', isActive: true, hitCount: 156, responseMode: 'direct', imageUrl: '', imageCaption: '' },
  { id: '5', priority: 5, name: 'Lokasi', triggerType: 'contains', triggerValue: 'lokasi|alamat|dimana|where', response: 'Kami berlokasi di Jl. Sudirman No. 123, Jakarta Pusat.', isActive: true, hitCount: 78, responseMode: 'ai_context', imageUrl: '', imageCaption: '' },
  { id: '6', priority: 10, name: 'Terima Kasih', triggerType: 'exact', triggerValue: 'terima kasih|makasih|thanks', response: 'Sama-sama kak! Senang bisa membantu.', isActive: false, hitCount: 34, responseMode: 'direct', imageUrl: '', imageCaption: '' },
];

export const mockKnowledge = [
  { id: '1', category: 'Harga', keyword: 'harga|biaya|tarif|price', content: 'Espresso: Rp 18.000\nAmericano: Rp 22.000\nLatte: Rp 28.000\nCappuccino: Rp 28.000\nMocha: Rp 32.000', isActive: true },
  { id: '2', category: 'Layanan', keyword: 'delivery|antar|kirim|ongkir', content: 'Kami melayani delivery dalam radius 5km. Minimal order Rp 50.000. Free ongkir untuk order di atas Rp 100.000.', isActive: true },
  { id: '3', category: 'Promo', keyword: 'promo|diskon|voucher|cashback', content: 'Promo Juli 2025: Beli 2 gratis 1 espresso-based. Member card diskon 10%. QRIS cashback 5%.', isActive: true },
  { id: '4', category: 'FAQ', keyword: 'parkir|wifi|toilet|mushola', content: 'Fasilitas: WiFi gratis, parkir luas, toilet bersih, mushola. Area smoking tersedia di outdoor.', isActive: true },
  { id: '5', category: 'Pembayaran', keyword: 'bayar|payment|transfer|qris', content: 'Metode pembayaran: Cash, QRIS, Transfer BCA/BNI/Mandiri. E-wallet: GoPay, OVO, Dana.', isActive: false },
];

export const mockTemplates = [
  { id: '1', name: 'Welcome Message', category: 'Greeting', content: 'Halo {nama}! Selamat datang di Toko Kopi Nusantara. Ada yang bisa kami bantu hari ini?' },
  { id: '2', name: 'Promo Bulanan', category: 'Marketing', content: 'Hai {nama}! Ada promo spesial bulan ini: Beli 2 gratis 1 untuk semua minuman. Yuk mampir!' },
  { id: '3', name: 'Follow Up', category: 'CRM', content: 'Halo {nama}, terima kasih sudah mengunjungi toko kami. Bagaimana pengalaman kopi-nya? Rate 1-5 ya!' },
  { id: '4', name: 'Reminder Event', category: 'Event', content: 'Jangan lupa {nama}, besok ada Coffee Tasting Session jam 14:00. See you there!' },
];

export const mockContacts = [
  { chatId: '6281234567890@c.us', name: 'Ahmad Fadli', phone: '081234567890', tag: 'customer,vip', note: 'Pelanggan tetap, suka latte', isBlocked: false, lastInteraction: '2025-07-07 14:30', messageCount: 45, sourceId: 'whatsapp' },
  { chatId: '6289876543210@c.us', name: 'Siti Nurhaliza', phone: '089876543210', tag: 'lead', note: '', isBlocked: false, lastInteraction: '2025-07-07 10:15', messageCount: 12, sourceId: 'whatsapp' },
  { chatId: '6281111222233@c.us', name: 'Budi Santoso', phone: '081111222233', tag: 'customer', note: 'Order delivery rutin', isBlocked: false, lastInteraction: '2025-07-06 18:45', messageCount: 89, sourceId: 'whatsapp' },
  { chatId: '6285555666677@c.us', name: 'Diana Putri', phone: '085555666677', tag: 'customer,member', note: 'Member card holder', isBlocked: false, lastInteraction: '2025-07-05 09:20', messageCount: 23, sourceId: 'whatsapp' },
  { chatId: '6282222333344@c.us', name: 'Spam User', phone: '082222333344', tag: '', note: 'Spam messages', isBlocked: true, lastInteraction: '2025-07-04 22:00', messageCount: 150, sourceId: 'whatsapp' },
  { chatId: '6287777888899@c.us', name: 'Rina Wati', phone: '087777888899', tag: 'lead,new', note: 'Tanya promo', isBlocked: false, lastInteraction: '2025-07-07 16:00', messageCount: 3, sourceId: 'whatsapp' },
];

export const mockMessages = [
  { timestamp: '2025-07-07 14:30:05', chatId: '6281234567890@c.us', direction: 'incoming', message: 'Halo, menu hari ini apa ya?', responseType: 'rule', tokensUsed: 0 },
  { timestamp: '2025-07-07 14:30:08', chatId: '6281234567890@c.us', direction: 'outgoing', message: 'Halo kak! Berikut menu kami hari ini:\n- Espresso: 18k\n- Americano: 22k\n- Latte: 28k', responseType: 'rule+ai', tokensUsed: 125 },
  { timestamp: '2025-07-07 10:15:22', chatId: '6289876543210@c.us', direction: 'incoming', message: 'Ada promo apa bulan ini?', responseType: 'ai', tokensUsed: 0 },
  { timestamp: '2025-07-07 10:15:25', chatId: '6289876543210@c.us', direction: 'outgoing', message: 'Promo Juli: Beli 2 gratis 1 untuk semua minuman espresso-based! Yuk mampir kak!', responseType: 'ai', tokensUsed: 89 },
  { timestamp: '2025-07-06 18:45:00', chatId: '6281111222233@c.us', direction: 'incoming', message: 'Bisa delivery ke Kemang?', responseType: 'knowledge+ai', tokensUsed: 0 },
  { timestamp: '2025-07-06 18:45:03', chatId: '6281111222233@c.us', direction: 'outgoing', message: 'Bisa kak! Delivery radius 5km, minimal order Rp 50.000. Free ongkir di atas Rp 100k.', responseType: 'knowledge+ai', tokensUsed: 112 },
  { timestamp: '2025-07-06 15:20:11', chatId: '6285555666677@c.us', direction: 'incoming', message: 'Parkir ada ga?', responseType: 'knowledge', tokensUsed: 0 },
  { timestamp: '2025-07-06 15:20:14', chatId: '6285555666677@c.us', direction: 'outgoing', message: 'Ada kak! Parkir luas, WiFi gratis, toilet bersih, dan mushola juga tersedia.', responseType: 'knowledge+ai', tokensUsed: 95 },
];

export const mockLogs = [
  { timestamp: '2025-07-07 14:30:05', type: 'WEBHOOK_IN', message: 'Pesan masuk dari 6281234****890' },
  { timestamp: '2025-07-07 14:30:06', type: 'RULE_MATCH', message: 'Rule "Menu" cocok untuk pesan dari 6281234****890' },
  { timestamp: '2025-07-07 14:30:08', type: 'AI_CALL', message: 'AI polish response, tokens: 125' },
  { timestamp: '2025-07-07 14:30:09', type: 'WAHA_SEND', message: 'Pesan terkirim ke 6281234****890' },
  { timestamp: '2025-07-07 10:15:22', type: 'WEBHOOK_IN', message: 'Pesan masuk dari 6289876****210' },
  { timestamp: '2025-07-07 10:15:23', type: 'AI_CALL', message: 'AI full response, tokens: 89' },
  { timestamp: '2025-07-07 10:15:25', type: 'WAHA_SEND', message: 'Pesan terkirim ke 6289876****210' },
  { timestamp: '2025-07-07 09:00:00', type: 'SYSTEM', message: 'Bot started successfully' },
  { timestamp: '2025-07-06 23:59:59', type: 'CLEANUP', message: 'Daily cleanup: 0 logs, 0 messages removed' },
  { timestamp: '2025-07-06 18:45:00', type: 'WEBHOOK_IN', message: 'Pesan masuk dari 6281111****233' },
  { timestamp: '2025-07-06 18:45:01', type: 'KNOWLEDGE_MATCH', message: 'Knowledge "Layanan" cocok' },
  { timestamp: '2025-07-06 18:45:03', type: 'AI_CALL', message: 'AI context response, tokens: 112' },
];

export const aiProviders = [
  { value: 'GEMINI', label: 'Google Gemini' },
  { value: 'GROQ', label: 'Groq' },
  { value: 'OPENROUTER', label: 'OpenRouter' },
  { value: 'DEEPSEEK', label: 'DeepSeek' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'ANTHROPIC', label: 'Anthropic Claude' },
  { value: 'OLLAMA', label: 'Ollama Server' },
];

export const aiModelOptions = {
  GEMINI: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  GROQ: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
  OPENROUTER: ['meta-llama/llama-3.1-8b-instruct:free', 'google/gemini-flash-1.5:free', 'mistralai/mistral-7b-instruct:free'],
  DEEPSEEK: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-v4-pro'],
  OPENAI: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  ANTHROPIC: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-20250219'],
  OLLAMA: [],
};

export const triggerTypes = [
  { value: 'contains', label: 'Contains (kata kunci)' },
  { value: 'exact', label: 'Exact Match' },
  { value: 'regex', label: 'Regex' },
  { value: 'startsWith', label: 'Starts With' },
];

export const responseModes = [
  { value: 'direct', label: 'Langsung kirim teks rule' },
  { value: 'ai_polish', label: 'Teks rule + dipoles AI' },
  { value: 'ai_context', label: 'Pakai AI sepenuhnya dengan konteks rule' },
];

export const mockAiSetupMessages = [
  { role: 'assistant', content: 'Halo! Saya bisa bantu menyiapkan data chatbot. Ceritakan bisnis Anda atau data apa yang ingin dimasukkan.' }
];

export const aiSetupChips = [
  'Coffee shop', 'FAQ dasar', 'Knowledge produk', 'Template broadcast', 'Atur AI Agent', 'Template lengkap'
];
