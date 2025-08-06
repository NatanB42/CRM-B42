import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Users, TrendingUp, AlertTriangle, RotateCcw, X, Search, Filter, Calendar, User, Tag as TagIcon, Settings, MoreVertical, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useContactMovement } from '../hooks/useContactMovement';
import { Contact, CRMData, PipelineStage } from '../types';
import { updateContact, deleteContact, getPipelineConfig, savePipelineConfig, type PipelineConfig } from '../lib/database';
import ContactActions from './ContactActions';
import ContactForm from './ContactForm';
import ContactDetailPanel from './ContactDetailPanel';
import PipelineStageManager from './PipelineStageManager';

interface PipelineManagerProps {
  data: CRMData;
  onDataChange: () => void;
  selectedListId?: string;
  onBackToLists: () => void;
}

export const PipelineManager: React.FC<PipelineManagerProps> = ({
  data,
  onDataChange,
  selectedListId,
  onBackToLists
}) => {
  const toast = useToast();
  // ✅ CORREÇÃO: Estado local otimizado para movimentação instantânea
  const [localContacts, setLocalContacts] = useState<Contact[]>([]);
  const [confirmedMoves, setConfirmedMoves] = useState<Set<string>>(new Set());
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // ✅ FILTROS REIMPLEMENTADOS
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ✅ NOVOS ESTADOS PARA MELHORIAS
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showStageManager, setShowStageManager] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState<string | null>(null);
  
  // ✅ NOVO: Estados para configuração personalizada do funil
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig | null>(null);
  const [showStageConfig, setShowStageConfig] = useState(false);
  const [tempVisibleStages, setTempVisibleStages] = useState<string[]>([]);
  const [tempStageOrder, setTempStageOrder] = useState<string[]>([]);
  const [configHasChanges, setConfigHasChanges] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  
  // ✅ NOVO: Estados de paginação individual por etapa
  const [stagePagination, setStagePagination] = useState<Record<string, {
    currentPage: number;
    itemsPerPage: number;
  }>>({});

  // Contact movement hook with optimistic updates
  const {
    moveContact,
    retryFailedMove,
    cancelMove,
    movingContacts,
    failedMoves,
    isMoving,
    hasFailed
  } = useContactMovement({
    onOptimisticUpdate: (contactId: string, newStageId: string) => {
      console.log('🎯 Atualização otimista:', contactId, newStageId);
      setLocalContacts(prev => prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, stageId: newStageId }
          : contact
      ));
    },
    onRevertUpdate: (contactId: string, originalStageId: string) => {
      console.log('🔄 Revertendo atualização:', contactId, originalStageId);
      setLocalContacts(prev => prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, stageId: originalStageId }
          : contact
      ));
      // Remover da lista de confirmados
      setConfirmedMoves(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    },
    // Callback para confirmar movimento
    onConfirmUpdate: (contactId: string, newStageId: string) => {
      console.log('✅ MOVIMENTO CONFIRMADO E SALVO:', contactId, 'Nova etapa:', newStageId);
      setConfirmedMoves(prev => new Set(prev).add(contactId));
      
      // Garantir que o estado local está correto
      setLocalContacts(prev => prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, stageId: newStageId }
          : contact
      ));
      
      // Forçar uma pequena atualização dos dados para sincronizar
      setTimeout(() => {
        console.log('🔄 Sincronizando dados após movimento confirmado...');
        onDataChange();
      }, 500);
    }
  });

  // ✅ NOVO: Carregar configuração do funil quando lista muda
  useEffect(() => {
    if (selectedListId) {
      loadPipelineConfig();
    }
  }, [selectedListId]);

  const loadPipelineConfig = async () => {
    if (!selectedListId) return;
    
    try {
      const config = await getPipelineConfig(selectedListId);
      setPipelineConfig(config);
      
      if (config) {
        setTempVisibleStages(config.visibleStages);
        setTempStageOrder(config.stageOrder);
      } else {
        // Configuração padrão - todas as etapas visíveis
        const allStageIds = data.pipelineStages.map(s => s.id);
        setTempVisibleStages(allStageIds);
        setTempStageOrder(allStageIds);
      }
      setConfigHasChanges(false);
    } catch (error) {
      console.error('Error loading pipeline config:', error);
      // Don't show error toast for missing config, just use defaults
      const allStageIds = data.pipelineStages.map(s => s.id);
      setTempVisibleStages(allStageIds);
      setTempStageOrder(allStageIds);
      setConfigHasChanges(false);
    }
  };

  const handleSavePipelineConfig = async () => {
    if (!selectedListId) return;
    
    setSavingConfig(true);
    try {
      const savedConfig = await savePipelineConfig(
        selectedListId, 
        tempVisibleStages, 
        tempStageOrder
      );
      
      setPipelineConfig(savedConfig);
      setConfigHasChanges(false);
      setShowStageConfig(false);
      toast.success('Configuração do funil salva!');
    } catch (error) {
      console.error('Error saving pipeline config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleStageVisibility = (stageId: string) => {
    setTempVisibleStages(prev => {
      const newVisible = prev.includes(stageId)
        ? prev.filter(id => id !== stageId)
        : [...prev, stageId];
      setConfigHasChanges(true);
      return newVisible;
    });
  };

  // ✅ FILTROS APLICADOS
  const filteredContacts = localContacts.filter(contact => {
    // Filtro de busca
    const matchesSearch = !searchTerm || 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtro de atendente
    const matchesAgent = !selectedAgent || contact.assignedAgentId === selectedAgent;

    // Filtro de tags
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tagId => contact.tags.includes(tagId));

    // Filtro de data
    let matchesDate = true;
    if (startDate) {
      const contactDate = new Date(contact.createdAt);
      const start = new Date(startDate);
      
      if (!endDate) {
        const contactDateOnly = new Date(contactDate.getFullYear(), contactDate.getMonth(), contactDate.getDate());
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        matchesDate = contactDateOnly >= startDateOnly;
      } else {
        const end = new Date(endDate);
        const contactDateOnly = new Date(contactDate.getFullYear(), contactDate.getMonth(), contactDate.getDate());
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        
        matchesDate = contactDateOnly >= startDateOnly && contactDateOnly <= endDateOnly;
      }
    }
    
    if (!startDate && endDate) {
      const contactDate = new Date(contact.createdAt);
      const end = new Date(endDate);
      const contactDateOnly = new Date(contactDate.getFullYear(), contactDate.getMonth(), contactDate.getDate());
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      
      matchesDate = contactDateOnly <= endDateOnly;
    }

    return matchesSearch && matchesAgent && matchesTags && matchesDate;
  });

  // Update local contacts when data changes
  useEffect(() => {
    console.log('🔄 Atualizando contatos locais...');
    if (selectedListId) {
      const listContacts = data.contacts.filter(contact => contact.listId === selectedListId);
      
      // ✅ CORREÇÃO: Preservar movimentos otimistas confirmados
      setLocalContacts(prev => {
        const updatedContacts = listContacts.map(contact => {
          // Se o contato foi movido otimisticamente e confirmado, manter a posição otimista
          const localContact = prev.find(lc => lc.id === contact.id);
          if (localContact && confirmedMoves.has(contact.id)) {
            console.log(`🎯 Preservando movimento confirmado para ${contact.id}: ${localContact.stageId}`);
            return { ...contact, stageId: localContact.stageId };
          }
          return contact;
        });
        
        console.log(`📋 Contatos atualizados para lista ${selectedListId}: ${updatedContacts.length} contatos`);
        return updatedContacts;
      });
    } else {
      // ✅ CORREÇÃO: Mesmo tratamento para todos os contatos
      setLocalContacts(prev => {
        const updatedContacts = data.contacts.map(contact => {
          const localContact = prev.find(lc => lc.id === contact.id);
          if (localContact && confirmedMoves.has(contact.id)) {
            console.log(`🎯 Preservando movimento confirmado para ${contact.id}: ${localContact.stageId}`);
            return { ...contact, stageId: localContact.stageId };
          }
          return contact;
        });
        
        console.log(`📋 Todos os contatos atualizados: ${updatedContacts.length} contatos`);
        return updatedContacts;
      });
    }
  }, [data.contacts, selectedListId, confirmedMoves]);

  // ✅ NOVO: Limpar movimentos confirmados quando mudar de lista
  useEffect(() => {
    setConfirmedMoves(new Set());
  }, [selectedListId]);

  // Get contacts by stage (with filters applied)
  const getContactsByStage = useCallback((stageId: string) => {
    return filteredContacts.filter(contact => contact.stageId === stageId);
  }, [filteredContacts]);

  // ✅ NOVO: Obter etapas visíveis baseadas na configuração
  const getVisibleStages = useCallback(() => {
    if (!pipelineConfig && tempVisibleStages.length === 0) {
      // Padrão: todas as etapas
      return [...data.pipelineStages].sort((a, b) => a.order - b.order);
    }
    
    const visibleStageIds = tempVisibleStages.length > 0 ? tempVisibleStages : (pipelineConfig?.visibleStages || []);
    const stageOrderIds = tempStageOrder.length > 0 ? tempStageOrder : (pipelineConfig?.stageOrder || []);
    
    // Filtrar apenas etapas visíveis
    const visibleStages = data.pipelineStages.filter(stage => 
      visibleStageIds.includes(stage.id)
    );
    
    // Ordenar conforme configuração personalizada ou ordem padrão
    if (stageOrderIds.length > 0) {
      return visibleStages.sort((a, b) => {
        const aIndex = stageOrderIds.indexOf(a.id);
        const bIndex = stageOrderIds.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    
    return visibleStages.sort((a, b) => a.order - b.order);
  }, [data.pipelineStages, pipelineConfig, tempVisibleStages, tempStageOrder]);

  // Get stage statistics
  const getStageStats = useCallback((stageId: string) => {
    const stageContacts = getContactsByStage(stageId);
    return {
      count: stageContacts.length,
      value: stageContacts.reduce((sum, contact) => {
        const value = contact.customFields?.value || 0;
        return sum + (typeof value === 'number' ? value : 0);
      }, 0)
    };
  }, [getContactsByStage]);

  // ✅ FUNÇÕES DE FILTRO
  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAgent('');
    setSelectedTags([]);
    setTagSearch('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = searchTerm || selectedAgent || selectedTags.length > 0 || startDate || endDate;

  const filteredTags = data.tags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  // ✅ NOVAS FUNÇÕES PARA MELHORIAS
  const handleContactDoubleClick = (contact: Contact) => {
    setSelectedContact(contact);
    setShowDetailPanel(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
    setContactMenuOpen(null);
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (confirm(`Tem certeza que deseja excluir o contato ${contact.name}?`)) {
      try {
        await deleteContact(contact.id);
        toast.success('Contato excluído com sucesso!');
        setContactMenuOpen(null);
      } catch (error) {
        console.error('Error deleting contact:', error);
        toast.error('Erro ao excluir contato');
      }
    }
  };

  const handleContactFormSubmit = async (contactData: Partial<Contact>) => {
    try {
      if (editingContact) {
        await updateContact(editingContact.id, contactData);
        toast.success('Contato atualizado com sucesso!');
      }
      setShowContactForm(false);
      setEditingContact(null);
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Erro ao salvar contato');
    }
  };

  const handleCloseDetailPanel = () => {
    setShowDetailPanel(false);
    setSelectedContact(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, contact: Contact) => {
    if (isMoving(contact.id) || hasFailed(contact.id)) {
      e.preventDefault();
      return;
    }
    
    setDraggedContact(contact);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contact.id);
    
    // Add visual feedback
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.transform = 'rotate(5deg)';
    dragImage.style.opacity = '0.8';
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the stage container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    
    if (!draggedContact || draggedContact.stageId === targetStageId) {
      setDraggedContact(null);
      return;
    }

    console.log('🎯 Movendo contato:', draggedContact.name, 'para etapa:', targetStageId);
    
    try {
      // ✅ CORREÇÃO: Usar hook de movimento otimizado
      moveContact(draggedContact.id, targetStageId, draggedContact.stageId);
      
      // ✅ CORREÇÃO: Feedback mais discreto
      console.log(`✅ Movimento iniciado para ${draggedContact.name}`);
    } catch (error) {
      console.error('❌ Erro ao mover contato:', error);
      toast.error('Erro ao mover contato');
    } finally {
      setDraggedContact(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedContact(null);
    setDragOverStage(null);
  };

  // Get the selected list name
  const selectedList = selectedListId ? data.lists.find(l => l.id === selectedListId) : null;

  // ✅ NOVO: Usar etapas visíveis configuradas
  const visibleStages = getVisibleStages();
  
  // ✅ NOVO: Função para obter configuração de paginação de uma etapa
  const getStagePagination = (stageId: string) => {
    return stagePagination[stageId] || { currentPage: 1, itemsPerPage: 10 };
  };
  
  // ✅ NOVO: Função para atualizar paginação de uma etapa específica
  const updateStagePagination = (stageId: string, updates: Partial<{ currentPage: number; itemsPerPage: number }>) => {
    setStagePagination(prev => ({
      ...prev,
      [stageId]: {
        ...getStagePagination(stageId),
        ...updates
      }
    }));
  };
  
  // ✅ NOVO: Função para obter contatos paginados de uma etapa
  const getPaginatedContactsByStage = (stageId: string) => {
    const stageContacts = getContactsByStage(stageId);
    const pagination = getStagePagination(stageId);
    
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    
    return {
      contacts: stageContacts.slice(startIndex, endIndex),
      totalContacts: stageContacts.length,
      totalPages: Math.ceil(stageContacts.length / pagination.itemsPerPage),
      currentPage: pagination.currentPage,
      itemsPerPage: pagination.itemsPerPage,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, stageContacts.length)
    };
  };
  
  // ✅ NOVO: Reset paginação quando filtros mudam
  useEffect(() => {
    // Reset todas as páginas para 1 quando filtros mudam
    setStagePagination(prev => {
      const newPagination = { ...prev };
      Object.keys(newPagination).forEach(stageId => {
        newPagination[stageId] = {
          ...newPagination[stageId],
          currentPage: 1
        };
      });
      return newPagination;
    });
  }, [searchTerm, selectedAgent, selectedTags, startDate, endDate]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToLists}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar para Listas</span>
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Funil de Vendas</h1>
            {selectedList && (
              <p className="text-sm text-gray-500">Lista: {selectedList.name}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* ✅ NOVO: Botão de Configuração do Funil */}
          <button
            onClick={() => setShowStageManager(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            title="Configurar Etapas do Funil"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurar Funil
          </button>
          
          {/* ✅ NOVO: Botão para configurar visualização do funil */}
          {selectedListId && (
            <button
              onClick={() => setShowStageConfig(true)}
              className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                configHasChanges
                  ? 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100'
                  : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
              }`}
              title="Personalizar visualização deste funil"
            >
              <Eye className="h-4 w-4 mr-2" />
              Personalizar Visualização
              {configHasChanges && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Não salvo
                </span>
              )}
            </button>
          )}
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              hasActiveFilters
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Ativo
              </span>
            )}
          </button>
          <div className="text-sm text-gray-500">
            {filteredContacts.length} de {localContacts.length} contatos
          </div>
        </div>
      </div>

      {/* ✅ FILTROS REIMPLEMENTADOS */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Busca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome, email ou empresa..."
                  className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Atendente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Atendente
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Todos os atendentes</option>
                {data.agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Buscar tags..."
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {filteredTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {filteredTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                            selectedTags.includes(tag.id)
                              ? 'text-white'
                              : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                          }`}
                          style={{
                            backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined
                          }}
                        >
                          <TagIcon className="h-3 w-3 mr-1" />
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Nenhuma tag encontrada</p>
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <div className="text-xs text-indigo-600">
                    {selectedTags.length} tag(s) selecionada(s)
                  </div>
                )}
              </div>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtro por Data
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Data inicial"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Data final"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {(startDate || endDate) && (
                  <div className="text-xs text-indigo-600 bg-indigo-50 p-2 rounded">
                    <strong>Filtro ativo:</strong>
                    {startDate && !endDate && ` A partir de ${new Date(startDate).toLocaleDateString('pt-BR')}`}
                    {!startDate && endDate && ` Até ${new Date(endDate).toLocaleDateString('pt-BR')}`}
                    {startDate && endDate && ` De ${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')}`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botão de limpar filtros */}
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pipeline Stages */}
      <div className="flex-1 overflow-x-auto bg-gray-50">
        <div className="flex space-x-6 p-6 min-w-max h-full">
          {visibleStages.map((stage) => {
            const paginatedData = getPaginatedContactsByStage(stage.id);
            const { contacts: stageContacts, totalContacts, totalPages, currentPage, itemsPerPage, startIndex, endIndex } = paginatedData;
            const stats = getStageStats(stage.id);
            const isDragOver = dragOverStage === stage.id;
            
            return (
              <div
                key={stage.id}
                className={`flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border-2 transition-all ${
                  isDragOver 
                    ? 'border-indigo-400 bg-indigo-50 scale-105' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      <span>{totalContacts}</span>
                    </div>
                  </div>
                  
                  {/* ✅ NOVO: Controles de paginação no topo */}
                  {totalContacts > 5 && (
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <div className="flex items-center space-x-2">
                        <span>Por página:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => updateStagePagination(stage.id, { 
                            itemsPerPage: Number(e.target.value),
                            currentPage: 1 
                          })}
                          className="text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={totalContacts}>Todos ({totalContacts})</option>
                        </select>
                      </div>
                      <span>{startIndex}-{endIndex} de {totalContacts}</span>
                    </div>
                  )}
                  
                  {stage.description && (
                    <p className="text-sm text-gray-600 mb-2">{stage.description}</p>
                  )}
                  
                  {stats.value > 0 && (
                    <div className="flex items-center space-x-1 text-sm text-green-600">
                      <TrendingUp className="w-4 h-4" />
                      <span>R$ {stats.value.toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                {/* Contacts */}
                <div className="p-4 space-y-3 min-h-[300px] max-h-96 overflow-y-auto">
                  {totalContacts === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum contato nesta etapa</p>
                      {isDragOver && (
                        <p className="text-xs text-indigo-600 mt-1">Solte aqui para mover</p>
                      )}
                    </div>
                  ) : stageContacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum contato nesta página</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {totalContacts} contatos total - página {currentPage} de {totalPages}
                      </p>
                    </div>
                  ) : (
                    stageContacts.map((contact) => {
                      const list = data.lists.find(l => l.id === contact.listId);
                      const agent = data.agents.find(a => a.id === contact.assignedAgentId);
                      const contactIsMoving = isMoving(contact.id);
                      const contactHasFailed = hasFailed(contact.id);
                      const isDragging = draggedContact?.id === contact.id;
                      
                      return (
                        <div
                          key={contact.id}
                          draggable={!contactIsMoving && !contactHasFailed}
                          onDragStart={(e) => handleDragStart(e, contact)}
                          onDragEnd={handleDragEnd}
                          onDoubleClick={() => handleContactDoubleClick(contact)}
                          className={`bg-white rounded-lg p-3 shadow-sm border transition-all select-none relative group ${
                            isDragging 
                              ? 'opacity-50 scale-105 rotate-2 z-50 cursor-grabbing border-indigo-300' 
                              : contactIsMoving 
                                ? 'border-blue-300 bg-blue-50 cursor-wait' 
                                : contactHasFailed 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-gray-200 hover:shadow-md cursor-grab hover:border-gray-300'
                          }`}
                          style={{
                            touchAction: 'none',
                            userSelect: 'none'
                          }}
                        >
                          {/* Loading/Error Overlay */}
                          {(contactIsMoving || contactHasFailed) && (
                            <div className="absolute inset-0 bg-white bg-opacity-90 rounded-lg flex items-center justify-center z-10">
                              {contactIsMoving && (
                                <div className="flex items-center text-blue-600">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                  <span className="text-xs font-medium">Movendo...</span>
                                </div>
                              )}
                              
                              {contactHasFailed && (
                                <div className="flex items-center space-x-2">
                                  <div className="flex items-center text-red-600">
                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                    <span className="text-xs font-medium">Falha</span>
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        retryFailedMove(contact.id);
                                      }}
                                      className="p-1 text-blue-600 hover:text-blue-800 bg-white rounded border border-blue-300 hover:bg-blue-50"
                                      title="Tentar novamente"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelMove(contact.id);
                                      }}
                                      className="p-1 text-red-600 hover:text-red-800 bg-white rounded border border-red-300 hover:bg-red-50"
                                      title="Cancelar"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Card Content */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {contact.name}
                              </h4>
                              <p className="text-xs text-gray-500 truncate">
                                {contact.email}
                              </p>
                              {contact.company && (
                                <p className="text-xs text-gray-500 truncate">
                                  {contact.company}
                                </p>
                              )}
                            </div>
                            
                            {/* ✅ NOVO: Menu de Ações do Contato */}
                            <div className="ml-2 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                              <ContactActions contact={contact} size="sm" />
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setContactMenuOpen(contactMenuOpen === contact.id ? null : contact.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600 rounded"
                                  title="Mais ações"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </button>
                                
                                {/* Menu Dropdown */}
                                {contactMenuOpen === contact.id && (
                                  <div className="absolute right-0 top-6 w-32 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                                    <div className="py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditContact(contact);
                                        }}
                                        className="flex items-center w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                      >
                                        <Edit2 className="h-3 w-3 mr-2" />
                                        Editar
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteContact(contact);
                                        }}
                                        className="flex items-center w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3 w-3 mr-2" />
                                        Excluir
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {!selectedListId && list && (
                                <span
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: list.color + '20',
                                    color: list.color
                                  }}
                                >
                                  {list.name}
                                </span>
                              )}
                              {contact.tags.slice(0, 2).map(tagId => {
                                const tag = data.tags.find(t => t.id === tagId);
                                return tag ? (
                                  <span
                                    key={tagId}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: tag.color + '20',
                                      color: tag.color
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ) : null;
                              })}
                              {contact.tags.length > 2 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  +{contact.tags.length - 2}
                                </span>
                              )}
                            </div>
                            {agent && (
                              <span className="text-xs text-gray-500 truncate ml-2">
                                {agent.name}
                              </span>
                            )}
                          </div>
                          
                          {contact.source && (
                            <div className="mt-2">
                              <span className="text-xs text-gray-400">
                                Fonte: {contact.source}
                              </span>
                            </div>
                          )}
                          
                          {/* ✅ NOVO: Indicador de clique duplo */}
                          <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-50 transition-opacity">
                            <span className="text-xs text-gray-400">Duplo clique para detalhes</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  
                  {/* ✅ NOVO: Controles de paginação na base */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        onClick={() => updateStagePagination(stage.id, { 
                          currentPage: Math.max(1, currentPage - 1) 
                        })}
                        disabled={currentPage === 1}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ←
                      </button>
                      
                      <span className="text-xs text-gray-500">
                        {currentPage} de {totalPages}
                      </span>
                      
                      <button
                        onClick={() => updateStagePagination(stage.id, { 
                          currentPage: Math.min(totalPages, currentPage + 1) 
                        })}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ✅ NOVOS MODAIS */}
      
      {/* Contact Form Modal */}
      {showContactForm && editingContact && (
        <ContactForm
          contact={editingContact}
          data={data}
          onSubmit={handleContactFormSubmit}
          onCancel={() => {
            setShowContactForm(false);
            setEditingContact(null);
          }}
        />
      )}

      {/* Contact Detail Panel */}
      {selectedContact && (
        <ContactDetailPanel
          contact={selectedContact}
          data={data}
          isOpen={showDetailPanel}
          onClose={handleCloseDetailPanel}
        />
      )}

      {/* ✅ NOVO: Pipeline Stage Manager */}
      {showStageManager && (
        <PipelineStageManager
          stages={data.pipelineStages}
          isOpen={showStageManager}
          onClose={() => setShowStageManager(false)}
          onDataChange={onDataChange}
        />
      )}

      {/* ✅ NOVO: Modal de Configuração de Visualização do Funil */}
      {showStageConfig && selectedListId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowStageConfig(false)} />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Personalizar Visualização do Funil
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Configure quais etapas aparecem neste funil: <strong>{selectedList?.name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowStageConfig(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Etapas Disponíveis
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Selecione quais etapas devem aparecer neste funil específico
                  </p>
                  
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {data.pipelineStages
                      .sort((a, b) => a.order - b.order)
                      .map(stage => (
                        <label 
                          key={stage.id} 
                          className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={tempVisibleStages.includes(stage.id)}
                            onChange={() => toggleStageVisibility(stage.id)}
                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                          />
                          <div className="ml-3 flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="text-sm text-gray-700">{stage.name}</span>
                          </div>
                        </label>
                      ))}
                  </div>
                  
                  <div className="mt-3 text-xs text-gray-500">
                    {tempVisibleStages.length} de {data.pipelineStages.length} etapas selecionadas
                  </div>
                {/* Preview */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Preview da Configuração</h5>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Etapas visíveis: </span>
                      <span className="text-blue-600">
                        {tempVisibleStages.length > 0 
                          ? tempVisibleStages
                              .map(id => data.pipelineStages.find(s => s.id === id)?.name)
                              .filter(Boolean)
                              .join(', ')
                          : 'Nenhuma etapa selecionada'
                        }
                      </span>
                    </div>
                    <div className="text-xs text-blue-600">
                      Esta configuração será salva apenas para este funil e não afetará outros funis.
                    </div>
                  </div>
                </div>
              </div>
                </div>
              <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    const allStageIds = data.pipelineStages.map(s => s.id);
                    setTempVisibleStages(allStageIds);
                    setTempStageOrder(allStageIds);
                    setConfigHasChanges(true);
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Mostrar Todas
                </button>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStageConfig(false);
                      // Resetar para configuração salva
                      if (pipelineConfig) {
                        setTempVisibleStages(pipelineConfig.visibleStages);
                        setTempStageOrder(pipelineConfig.stageOrder);
                      }
                      setConfigHasChanges(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePipelineConfig}
                    disabled={!configHasChanges || savingConfig || tempVisibleStages.length === 0}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingConfig ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Configuração
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Click outside to close contact menu */}
      {contactMenuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setContactMenuOpen(null)}
        />
      )}
    </div>
  );
};