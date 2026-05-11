import React from 'react';
import { useApp } from '../App';
import {
  LayoutDashboard, Key, Plug, Brain, GitBranch, BookOpen, FileText,
  Users, MessageSquare, Radio, Sparkles, RotateCcw, Settings,
  FlaskConical, ScrollText, LogOut, Menu, X, Bot, ChevronLeft,
  UserCog, ShieldCheck, UserCircle, BookMarked, Palette
} from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

import Dashboard from '../pages/Dashboard';
import License from '../pages/License';
import Connections from '../pages/Connections';
import AIAgent from '../pages/AIAgent';
import RulesEngine from '../pages/RulesEngine';
import KnowledgeBase from '../pages/KnowledgeBase';
import Templates from '../pages/Templates';
import Contacts from '../pages/Contacts';
import Messages from '../pages/Messages';
import Broadcast from '../pages/Broadcast';
import AISetup from '../pages/AISetup';
import ResetData from '../pages/ResetData';
import SettingsPage from '../pages/Settings';
import TestCenter from '../pages/TestCenter';
import Logs from '../pages/Logs';
import UserManagement from '../pages/UserManagement';
import Documentation from '../pages/Documentation';
import Branding from '../pages/Branding';

const superadminNavItems = [
  { id: 'user-management', label: 'Kelola User', icon: UserCog, group: 'main' },
  { id: 'branding', label: 'Branding', icon: Palette, group: 'main' },
  { id: 'docs', label: 'Dokumentasi', icon: BookMarked, group: 'main' },
];

const userNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'license', label: 'Lisensi', icon: Key, group: 'main' },
  { id: 'connections', label: 'Koneksi', icon: Plug, group: 'main' },
  { id: 'ai-agent', label: 'AI Agent', icon: Brain, group: 'bot' },
  { id: 'rules', label: 'Rules Engine', icon: GitBranch, group: 'bot' },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, group: 'bot' },
  { id: 'templates', label: 'Template', icon: FileText, group: 'bot' },
  { id: 'contacts', label: 'Kontak', icon: Users, group: 'data' },
  { id: 'messages', label: 'Pesan', icon: MessageSquare, group: 'data' },
  { id: 'broadcast', label: 'Broadcast', icon: Radio, group: 'data' },
  { id: 'ai-setup', label: 'AI Setup', icon: Sparkles, group: 'tools' },
  { id: 'test-center', label: 'Test Center', icon: FlaskConical, group: 'tools' },
  { id: 'logs', label: 'Logs', icon: ScrollText, group: 'tools' },
  { id: 'reset-data', label: 'Reset Data', icon: RotateCcw, group: 'system' },
  { id: 'settings', label: 'Setting', icon: Settings, group: 'system' },
  { id: 'docs', label: 'Dokumentasi', icon: BookMarked, group: 'system' },
];

const groupLabels = {
  main: 'Utama',
  bot: 'Chatbot',
  data: 'Data',
  tools: 'Tools',
  system: 'Sistem',
};

const pageComponents = {
  'dashboard': Dashboard,
  'license': License,
  'connections': Connections,
  'ai-agent': AIAgent,
  'rules': RulesEngine,
  'knowledge': KnowledgeBase,
  'templates': Templates,
  'contacts': Contacts,
  'messages': Messages,
  'broadcast': Broadcast,
  'ai-setup': AISetup,
  'test-center': TestCenter,
  'logs': Logs,
  'user-management': UserManagement,
  'branding': Branding,
  'reset-data': ResetData,
  'settings': SettingsPage,
  'docs': Documentation,
};

const roleBadge = {
  superadmin: { label: 'Super Admin', className: 'bg-emerald-500/20 text-emerald-300' },
  user: { label: 'User', className: 'bg-blue-500/20 text-blue-300' },
};

const Layout = () => {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen, logout, currentUser } = useApp();
  const role = currentUser?.role || 'user';
  const isSuperAdmin = role === 'superadmin';

  const navItems = isSuperAdmin ? superadminNavItems : userNavItems;
  const groups = isSuperAdmin ? ['main'] : ['main', 'bot', 'data', 'tools', 'system'];

  // Superadmin can access user-management, branding, and docs; user never accesses these
  const superadminAllowed = ['user-management', 'branding', 'docs'];
  const userBlocked = ['user-management', 'branding'];
  const safeTab = isSuperAdmin
    ? (superadminAllowed.includes(activeTab) ? activeTab : 'user-management')
    : (userBlocked.includes(activeTab) ? 'dashboard' : activeTab);
  const ActivePage = pageComponents[safeTab] || Dashboard;

  const allNavItems = [...superadminNavItems, ...userNavItems];
  const activeLabel = allNavItems.find(n => n.id === safeTab)?.label || 'Dashboard';
  const badge = roleBadge[role] || roleBadge.user;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out ${
            sidebarOpen ? 'w-64' : 'w-0 lg:w-[68px]'
          } overflow-hidden`}
        >
          {/* Logo area */}
          <div className="flex items-center h-16 px-4 border-b border-white/10 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className={`ml-3 overflow-hidden transition-all duration-300 ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 lg:opacity-0 lg:w-0'}`}>
              <h1 className="font-bold text-sm whitespace-nowrap">adminpintar.id</h1>
              <p className="text-[10px] text-slate-400 whitespace-nowrap">v1.2.0</p>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden lg:flex"
            >
              <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1" style={{ scrollbarWidth: 'none' }}>
            {groups.map((group) => {
              const items = navItems.filter(item => item.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-2">
                  {sidebarOpen && (
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">
                      {groupLabels[group]}
                    </p>
                  )}
                  {!sidebarOpen && group !== 'main' && (
                    <div className="mx-auto w-6 border-t border-white/10 my-2" />
                  )}
                  {items.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    const btn = (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          if (window.innerWidth < 1024) setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        } ${!sidebarOpen ? 'justify-center' : ''}`}
                      >
                        <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                          isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                        }`} />
                        {sidebarOpen && (
                          <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                        )}
                        {isActive && sidebarOpen && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );

                    if (!sidebarOpen) {
                      return (
                        <Tooltip key={item.id}>
                          <TooltipTrigger asChild>{btn}</TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    return <React.Fragment key={item.id}>{btn}</React.Fragment>;
                  })}
                </div>
              );
            })}
          </nav>

          {/* Current user info + Logout */}
          <div className="border-t border-white/10 flex-shrink-0">
            {sidebarOpen && currentUser && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">
                    {(currentUser.fullName || currentUser.username || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {currentUser.fullName || currentUser.username}
                  </p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
            )}
            <div className="p-3 pt-0">
              <button
                onClick={logout}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                {sidebarOpen && <span>Logout</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="h-16 flex items-center px-4 lg:px-6 bg-white border-b border-slate-200 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors mr-3"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{activeLabel}</h2>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700">Bot Aktif</span>
              </div>
              {currentUser && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                  <UserCircle className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">
                    {currentUser.fullName || currentUser.username}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    role === 'superadmin' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {badge.label}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-slate-500 hover:text-red-500 hover:bg-red-50 hidden sm:flex"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </Button>
            </div>
          </header>

          {/* Page Content */}
          <main className={`flex-1 overflow-y-auto animate-fade-in ${safeTab === 'docs' ? 'p-0 overflow-hidden flex flex-col' : 'p-4 lg:p-6'}`}>
            <ActivePage />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
