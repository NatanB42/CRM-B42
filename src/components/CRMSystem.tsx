import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  Users, 
  List, 
  UserCheck, 
  Settings, 
  Folder,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useRealtime } from '../hooks/useRealtime';
import { logout, getCurrentUser } from '../lib/auth';
import { initializeDatabase, loadAllData } from '../lib/database';
import { CRMData, Contact } from '../types';
import { exportContactsToCSV } from '../utils/csvExport';

// Import components
import Dashboard from './Dashboard';
import ContactManager from './ContactManager';
import ListManager from './ListManager';
import ListIdDisplay from './ListIdDisplay';
import { PipelineManager } from './PipelineManager';
import AgentManager from './AgentManager';
import SettingsPanel from './SettingsPanel';
import FolderManager from './FolderManager';
import ToastContainer from './ToastContainer';
 

const CRMSystem: React.FC = () => {
  const [data, setData] = useState<CRMData>({
    contacts: [],
    lists: [],
    agents: [],
    pipelineStages: [],
    tags: [],
    customFields: []
  });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const toast = useToast();
  const user = getCurrentUser();
  const [isInitialized, setIsInitialized] = useState(false);

  // Load data function
  const loadData = useCallback(async () => {
    try {
      console.log('🔄 Carregando dados do CRM...');
      const crmData = await loadAllData();
      setData(crmData);
      console.log('✅ Dados carregados:', {
        contacts: crmData.contacts.length,
        lists: crmData.lists.length,
        agents: crmData.agents.length,
        stages: crmData.pipelineStages.length,
        tags: crmData.tags.length,
        customFields: crmData.customFields.length
      });
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      setError('Erro ao carregar dados do CRM');
      toast.error('Erro ao carregar dados');
    }
  }, [toast]);

  // Initialize system
  useEffect(() => {
    if (isInitialized) return;
    
    const initSystem = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Initialize database connection
        await initializeDatabase();
        
        // Load initial data
        await loadData();
        
        setIsInitialized(true);
        
      } catch (error) {
        console.error('❌ Erro ao inicializar sistema:', error);
        setError('Erro ao conectar com o banco de dados');
        toast.error('Erro ao inicializar sistema');
      } finally {
        setLoading(false);
      }
    };

    initSystem();
  }, [isInitialized, toast]);

  // Setup realtime updates
  useRealtime(useCallback(() => {
    if (isInitialized) {
      loadData();
    }
  }, [loadData, isInitialized]));

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const handleExportFiltered = (contacts: Contact[]) => {
    exportContactsToCSV(contacts, data, 'contatos-filtrados');
    toast.success(`${contacts.length} contatos exportados!`);
  };

  const handleOpenListPipeline = (listId: string) => {
    setSelectedListId(listId);
    setActiveTab('pipeline');
  };

  const handleBackToLists = () => {
    setSelectedListId(null);
    setActiveTab('lists');
  };

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'contacts', name: 'Contatos', icon: Users },
    { id: 'lists', name: 'Listas', icon: List },
    { id: 'list-ids', name: 'IDs das Listas', icon: List },
    { id: 'agents', name: 'Atendentes', icon: UserCheck },
    { id: 'folders', name: 'Pastas', icon: Folder },
    { id: 'settings', name: 'Configurações', icon: Settings },
    
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Carregando CRM</h2>
          <p className="text-gray-600">Conectando com o banco de dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4">
            <X className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro de Conexão</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard data={data} onDataChange={loadData} />;
      case 'contacts':
        return (
          <ContactManager 
            data={data} 
            onDataChange={loadData}
            onExportFiltered={handleExportFiltered}
          />
        );
      case 'lists':
        return (
          <ListManager 
            data={data} 
            onDataChange={loadData}
            onOpenListPipeline={handleOpenListPipeline}
          />
        );
        case 'list-ids':
          return <ListIdDisplay lists={data.lists} />;

      case 'pipeline':
        return (
          <PipelineManager
            data={data}
            onDataChange={loadData}
            selectedListId={selectedListId}
            onBackToLists={handleBackToLists}
          />
        );
      case 'agents':
        return <AgentManager data={data} onDataChange={loadData} />;
      case 'folders':
        return <FolderManager data={data} onDataChange={loadData} />;
      case 'settings':
        return <SettingsPanel data={data} onDataChange={loadData} />;
      default:
        return <Dashboard data={data} onDataChange={loadData} />;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <h1 className="text-xl font-bold text-gray-900">CRM System</h1>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`${
                      activeTab === item.id
                        ? 'bg-indigo-100 text-indigo-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md w-full`}
                  >
                    <Icon className="mr-4 h-6 w-6" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900">CRM B42</h1>
              </div>
              <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`${
                        activeTab === item.id
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full`}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-indigo-600">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                  <button
                    onClick={handleLogout}
                    className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Content area */}
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
};

export default CRMSystem;