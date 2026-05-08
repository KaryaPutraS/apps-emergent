# API Contracts - ChatBot Manager Dashboard

## A) API Endpoints

### Auth
- `POST /api/auth/login` — `{ password }` → `{ success, token, message }`
- `POST /api/auth/logout` — `{ token }` → `{ success }`
- `GET /api/auth/check` — Header `Authorization: Bearer <token>` → `{ valid, license }`

### Dashboard
- `GET /api/dashboard/stats` → `{ totalMessages, totalContacts, activeRules, aiCalls, tokensUsed, botActive, uptime, avgResponseTime }`
- `GET /api/dashboard/chart` → `[{ date, messagesIn, messagesOut, rulesMatched, aiCalls }]`

### Config
- `GET /api/config` → full config object
- `PUT /api/config` — `{ key: value, ... }` → `{ success }`
- `GET /api/config/ai-agent` → AI agent specific config
- `PUT /api/config/ai-agent` — `{ systemPrompt, businessInfo, ... }` → `{ success }`

### License
- `GET /api/license` → `{ valid, status, licenseKey, customerName, planName, expiresAt }`
- `POST /api/license/activate` — `{ licenseKey }` → license status
- `DELETE /api/license` → `{ success }`

### Rules
- `GET /api/rules` → `[{ id, priority, name, triggerType, triggerValue, response, isActive, hitCount, responseMode, imageUrl, imageCaption }]`
- `POST /api/rules` — rule object → `{ success, rule }`
- `DELETE /api/rules/{id}` → `{ success }`

### Knowledge
- `GET /api/knowledge` → `[{ id, category, keyword, content, isActive }]`
- `POST /api/knowledge` — knowledge object → `{ success, item }`
- `DELETE /api/knowledge/{id}` → `{ success }`

### Templates
- `GET /api/templates` → `[{ id, name, content, category }]`
- `POST /api/templates` — template object → `{ success, item }`
- `DELETE /api/templates/{id}` → `{ success }`

### Contacts
- `GET /api/contacts?search=` → `[{ chatId, name, phone, tag, note, isBlocked, lastInteraction, messageCount, sourceId }]`
- `PUT /api/contacts/{chatId}` — contact updates → `{ success }`
- `DELETE /api/contacts/{chatId}` → `{ success }`

### Messages
- `GET /api/messages?limit=50` → `[{ timestamp, chatId, direction, message, responseType, tokensUsed }]`

### Broadcast
- `POST /api/broadcast/check` — `{ target, tag, customNumbers }` → `{ count }`
- `POST /api/broadcast/send` — `{ target, tag, customNumbers, message }` → `{ success, sent }`

### Logs
- `GET /api/logs?limit=50` → `[{ timestamp, type, message }]`

### Test
- `POST /api/test/rule` — `{ message }` → `{ type, status, detail }`
- `POST /api/test/knowledge` — `{ message }` → `{ type, status, detail }`
- `POST /api/test/full-flow` — `{ message }` → `{ type, status, detail }`

### Reset
- `POST /api/reset/config` → `{ success, message }`
- `POST /api/reset/dashboard` → `{ success, message }`
- `POST /api/reset/messages` → `{ success, message }`
- `POST /api/reset/contacts` → `{ success, message }`

## B) Mock Data → Real Data Mapping
- `mockStats` → GET /api/dashboard/stats (computed from messages, contacts, rules collections)
- `mockChartData` → GET /api/dashboard/chart (aggregated from messages collection)
- `mockConfig` → GET /api/config
- `mockRules` → GET /api/rules
- `mockKnowledge` → GET /api/knowledge
- `mockTemplates` → GET /api/templates
- `mockContacts` → GET /api/contacts
- `mockMessages` → GET /api/messages
- `mockLogs` → GET /api/logs
- `mockLicense` → GET /api/license

## C) Backend Implementation
- MongoDB collections: config, rules, knowledge, templates, contacts, messages, logs, sessions
- Password hashed with bcrypt, stored in config
- Session token stored in sessions collection with TTL
- Seed default config + sample data on first run
- All endpoints require valid session token except login

## D) Frontend Integration
- Create apiClient.js with axios instance + token interceptor
- Replace all useState(mockData) with useEffect + API fetch
- Add loading states and error handling
- CRUD operations call real API then update local state
