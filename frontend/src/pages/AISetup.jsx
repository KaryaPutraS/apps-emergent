import React, { useState } from 'react';
import { aiSetupChat, saveRule, saveKnowledge, saveTemplate, updateConfig, updateAIAgentConfig } from '../api/apiClient';
import { Sparkles, Send, Check, Trash2, Eraser, Info, AlertCircle, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const aiSetupChips = [
  { label: '☕ Coffee shop', prompt: 'Buatkan setup lengkap untuk bisnis coffee shop: rules greeting, menu, jam buka, knowledge FAQ, dan template pesan.' },
  { label: '🛍️ Toko online', prompt: 'Buatkan setup lengkap untuk toko online: rules greeting, cara order, cek ongkir, knowledge produk, dan template follow-up.' },
  { label: '🏥 Klinik / Kesehatan', prompt: 'Buatkan setup lengkap untuk klinik: rules greeting, jadwal dokter, cara daftar, knowledge layanan, dan template reminder.' },
  { label: '🏨 Hotel / Penginapan', prompt: 'Buatkan setup lengkap untuk hotel: rules greeting, info kamar, cara booking, knowledge fasilitas, dan template konfirmasi.' },
  { label: '📦 Data contoh kosong', prompt: 'Buatkan 3 rules dasar (greeting, info bisnis, penutup), 2 knowledge umum, dan 2 template pesan sebagai contoh data awal yang bisa saya edit sendiri.' },
  { label: '🤖 Atur AI Agent', prompt: 'Bantu saya mengatur konfigurasi AI Agent: system prompt, informasi bisnis, temperatur AI, dan batasan token yang optimal.' },
];
const defaultMessages = [{ role: 'assistant', content: 'Halo! Saya bisa bantu menyiapkan data adminpintar.id. Pilih template bisnis di bawah atau ceritakan bisnis Anda untuk saya buatkan rules, knowledge, dan template secara otomatis.' }];

const AISetup = () => {
  const [messages, setMessages] = useState(defaultMessages);
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Build history from messages (excluding the first default assistant message)
  const buildHistory = (msgs) => {
    return msgs.slice(1).map(m => ({ role: m.role, content: m.content }));
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = buildHistory(newMessages);
      const response = await aiSetupChat(input, history);

      if (response.success) {
        // Add AI reply to chat
        const aiMsg = { role: 'assistant', content: response.reply };
        setMessages(prev => [...prev, aiMsg]);

        // If there are drafts, add them
        if (response.drafts && response.drafts.length > 0) {
          setDrafts(prev => [...prev, ...response.drafts]);
          toast.success(`AI menyiapkan ${response.drafts.length} draft!`);
        }

        // If AI needs more info
        if (response.need_more_info) {
          toast.info('AI membutuhkan info tambahan. Silakan balas.');
        }
      } else {
        const errMsg = { role: 'assistant', content: response.reply || response.error || 'Maaf, terjadi kesalahan. Coba lagi.' };
        setMessages(prev => [...prev, errMsg]);
        toast.error(response.error || 'AI Setup gagal merespon.');
      }
    } catch (e) {
      const errorDetail = e.response?.data?.detail || e.message || 'Gagal menghubungi AI Setup API.';
      const errMsg = { role: 'assistant', content: `Error: ${errorDetail}` };
      setMessages(prev => [...prev, errMsg]);
      toast.error(errorDetail);
    } finally {
      setLoading(false);
    }
  };

  const handleChip = (chip) => {
    setInput(chip.prompt);
  };

  const handleClearChat = () => {
    setMessages(defaultMessages);
    toast.success('Chat dibersihkan!');
  };

  const removeDraft = (index) => {
    setDrafts(drafts.filter((_, i) => i !== index));
  };

  // Save all drafts to their respective collections
  const handleSaveAllDrafts = async () => {
    if (drafts.length === 0) return;
    setSaving(true);

    let saved = 0;
    let errors = 0;

    for (const draft of drafts) {
      try {
        const dType = draft.type?.toLowerCase();
        const dData = draft.data || {};

        if (dType === 'rule' || dType === 'rules') {
          await saveRule({
            name: dData.name || draft.summary || 'AI Rule',
            triggerType: dData.trigger_type || dData.triggerType || 'contains',
            triggerValue: dData.trigger_value || dData.triggerValue || dData.trigger || '',
            response: dData.response || dData.value || '',
            isActive: true,
            priority: dData.priority || 10,
            responseMode: dData.response_mode || dData.responseMode || 'direct',
            imageUrl: dData.image_url || dData.imageUrl || '',
            imageCaption: dData.image_caption || dData.imageCaption || '',
          });
          saved++;
        } else if (dType === 'knowledge' || dType === 'knowledge_base') {
          await saveKnowledge({
            category: dData.category || draft.summary || 'AI Knowledge',
            keyword: dData.keyword || dData.keywords || '',
            content: dData.content || dData.value || '',
            isActive: true,
          });
          saved++;
        } else if (dType === 'template' || dType === 'templates') {
          await saveTemplate({
            name: dData.name || draft.summary || 'AI Template',
            category: dData.category || 'AI Generated',
            content: dData.content || dData.value || '',
          });
          saved++;
        } else if (dType === 'config' || dType === 'setting' || dType === 'settings') {
          // Config updates - could be system_prompt, business_info, etc.
          const key = dData.key || '';
          const value = dData.value || '';

          if (key && value) {
            // Map common keys from API to our config keys
            const keyMap = {
              'system_prompt': 'systemPrompt',
              'business_info': 'businessInfo',
              'ai_temperature': 'aiTemperature',
              'ai_max_tokens': 'aiMaxTokens',
              'memory_limit': 'memoryLimit',
              'memory_timeout_minutes': 'memoryTimeoutMinutes',
              'offline_message': 'offlineMessage',
              'working_hours_start': 'workingHoursStart',
              'working_hours_end': 'workingHoursEnd',
            };

            const mappedKey = keyMap[key] || key;

            // Check if it's an AI agent config key
            const aiAgentKeys = ['systemPrompt', 'businessInfo', 'aiTemperature', 'aiMaxTokens', 'memoryLimit', 'memoryTimeoutMinutes', 'ruleAiEnabled'];
            if (aiAgentKeys.includes(mappedKey)) {
              await updateAIAgentConfig({ [mappedKey]: value });
            } else {
              await updateConfig({ [mappedKey]: value });
            }
            saved++;
          }
        } else {
          // Unknown type, try to save as config
          if (dData.key && dData.value) {
            await updateConfig({ [dData.key]: dData.value });
            saved++;
          } else {
            errors++;
          }
        }
      } catch (e) {
        console.error('Error saving draft:', draft, e);
        errors++;
      }
    }

    setSaving(false);
    setDrafts([]);

    if (errors === 0) {
      toast.success(`Semua ${saved} draft berhasil disimpan!`);
    } else {
      toast.warning(`${saved} draft berhasil, ${errors} draft gagal disimpan.`);
    }
  };

  // Get color for draft type badge
  const getDraftTypeColor = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'rule' || t === 'rules') return 'bg-violet-50 text-violet-700';
    if (t === 'knowledge' || t === 'knowledge_base') return 'bg-blue-50 text-blue-700';
    if (t === 'template' || t === 'templates') return 'bg-amber-50 text-amber-700';
    if (t === 'config' || t === 'setting' || t === 'settings') return 'bg-emerald-50 text-emerald-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Setup Assistant</h1>
          <p className="text-slate-500 text-sm mt-0.5">Isi Rules, Knowledge, Template, dan Setting lewat chat AI.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleClearChat} className="gap-2">
          <Eraser className="w-4 h-4" /> Bersihkan Chat
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Alur aman: ngobrol dengan AI &rarr; AI membuat draft &rarr; cek preview &rarr; klik Simpan Semua Draft.
            AI Setup menggunakan API <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-800 text-xs font-mono">lisensi.satroai.pro/ai-setup</code>.
            Pastikan lisensi sudah aktif.
          </span>
        </p>
      </div>

      {/* Scope info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h4 className="font-semibold text-slate-800 text-sm mb-2">Yang Bisa Diatur AI Setup</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div><strong>Rules Engine</strong> — Auto-reply rules dengan trigger dan response otomatis.</div>
          <div><strong>Knowledge Base</strong> — Data pengetahuan bisnis untuk konteks AI.</div>
          <div><strong>Template Pesan</strong> — Nama template, kategori, dan isi pesan broadcast.</div>
          <div><strong>AI Agent Config</strong> — System Prompt, Informasi Bisnis, parameter AI.</div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Tetap aman: semua hasil AI masuk ke Preview Draft dulu sebelum disimpan.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">Chat dengan AI Setup</h3>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {aiSetupChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleChip(chip)}
                className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="h-72 overflow-y-auto border border-slate-100 rounded-lg p-3 space-y-3 mb-3 bg-slate-50/50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                }`}>
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Contoh: Buatkan rule jika user tanya harga, jawab Paket Basic 99rb..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <div className="flex gap-2 mt-3">
            <Button onClick={handleSend} disabled={loading || !input.trim()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menunggu AI...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Kirim ke AI</>
              )}
            </Button>
          </div>
        </div>

        {/* Draft Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-900 text-sm">Preview Draft</h3>
            {drafts.length > 0 && (
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-xs">
                {drafts.length} draft
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">Data belum masuk database sampai Anda klik simpan.</p>

          {drafts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Belum ada draft. Kirim pesan ke AI untuk generate data.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {drafts.map((draft, i) => (
                <div key={i} className="p-3 border border-slate-200 rounded-lg bg-slate-50 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] uppercase font-mono ${getDraftTypeColor(draft.type)}`}>
                        {draft.type}
                      </Badge>
                      <span className="text-sm font-medium text-slate-700">{draft.summary}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDraft(i)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {draft.data && (
                    <div className="mt-2 text-xs text-slate-500 bg-white rounded border border-slate-100 p-2 font-mono break-all max-h-24 overflow-y-auto">
                      {typeof draft.data === 'object' ? (
                        Object.entries(draft.data).map(([key, val]) => (
                          <div key={key} className="mb-0.5">
                            <span className="text-slate-400">{key}:</span>{' '}
                            <span className="text-slate-700">{typeof val === 'string' ? val.substring(0, 200) : JSON.stringify(val)}</span>
                          </div>
                        ))
                      ) : (
                        <span>{JSON.stringify(draft.data)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleSaveAllDrafts}
              disabled={drafts.length === 0 || saving}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
              ) : (
                <><Save className="w-4 h-4" /> Simpan Semua Draft ({drafts.length})</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDrafts([])}
              disabled={drafts.length === 0}
              className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Hapus Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISetup;
