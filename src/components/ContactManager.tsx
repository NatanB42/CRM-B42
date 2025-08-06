import React, { useState, useCallback } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Mail, Phone, Tag as TagIcon, Download, CheckSquare, Square, MoreHorizontal, Calendar, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Contact, CRMData } from '../types';
import ContactForm from './ContactForm';
import ContactDetailPanel from './ContactDetailPanel';
import ContactActions from './ContactActions';
import ImportProgressIndicator from './ImportProgressIndicator';
import CSVImportModal, { ImportProgress } from './CSVImportModal';
import { createContact, updateContact, deleteContact, updateContacts } from '../lib/database';

interface ContactManagerProps {
  data: CRMData;
  onDataChange: () => void;
  onExportFiltered: (contacts: Contact[]) => void;
}

const ContactManager: React.FC<ContactManagerProps> = ({ data, onDataChange, onExportFiltered }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedList, setSelectedList] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImportActive, setIsImportActive] = useState(false);
  const [preventPageUnload, setPreventPageUnload] = useState(false);
  const toast = useToast();

  // Prevent page reload/unload during import
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (preventPageUnload) {
        e.preventDefault();
        e.returnValue = 'Importação em andamento. Tem certeza que deseja sair?';
        return 'Importação em andamento. Tem certeza que deseja sair?';
      }
    };

    const handleUnload = (e: Event) => {
      if (preventPageUnload) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [preventPageUnload]);
  const filteredContacts = data.contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesList = !selectedList || contact.listId === selectedList;
    const matchesStage = !selectedStage || contact.stageId === selectedStage;
    const matchesAgent = !selectedAgent || contact.assignedAgentId === selectedAgent;
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tagId => contact.tags.includes(tagId));
    
    // CORREÇÃO 2: Implementar filtro de data funcional
    let matchesDate = true;
    if (startDate) {
      const contactDate = new Date(contact.createdAt);
      const start = new Date(startDate);
      
      // Se não há data final, usar apenas data inicial como filtro "a partir de"
      if (!endDate) {
        // Comparar apenas a data (sem horário) para filtro "a partir de"
        const contactDateOnly = new Date(contactDate.getFullYear(), contactDate.getMonth(), contactDate.getDate());
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        matchesDate = contactDateOnly >= startDateOnly;
      } else {
        // Se há data final, filtrar por intervalo
        const end = new Date(endDate);
        const contactDateOnly = new Date(contactDate.getFullYear(), contactDate.getMonth(), contactDate.getDate());
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        
        matchesDate = contactDateOnly >= startDateOnly && contactDateOnly <= endDateOnly;
      }
    }
    
    // CORREÇÃO 2: Filtro adicional por data final se apenas ela estiver preenchida
    if (!startDate && endDate) {
      const contactDate = new Date(contact.createdAt);
      const end = new Date(endDate);
      const contactDateOnly = new Date(contactDate.getFullYear(), contactDate.getMonth(), contactDate.getDate());
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      
      matchesDate = contactDateOnly <= endDateOnly;
    }
    
    return matchesSearch && matchesList && matchesStage && matchesAgent && matchesTags && matchesDate;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // Log para debug
  React.useEffect(() => {
    console.log(`📊 ContactManager: ${data.contacts.length.toLocaleString('pt-BR')} contatos totais, ${filteredContacts.length.toLocaleString('pt-BR')} filtrados, ${paginatedContacts.length} na página atual`);
  }, [data.contacts.length, filteredContacts.length, paginatedContacts.length]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedList, selectedStage, selectedAgent, selectedTags, startDate, endDate]);

  const handleSubmit = async (contactData: Partial<Contact>) => {
    console.log('📝 Dados do formulário:', contactData);
    
    try {
      if (editingContact) {
        await updateContact(editingContact.id, contactData);
      } else {
        // ✅ Ensure required fields are present
        if (!contactData.name || !contactData.email) {
          alert('Nome e email são obrigatórios');
          return;
        }
        
        await createContact({
          name: contactData.name || '',
          email: contactData.email || '',
          phone: contactData.phone || '',
          company: contactData.company || '',
          instagram: contactData.instagram || '',
          listId: contactData.listId || data.lists[0]?.id || '',
          stageId: contactData.stageId || data.pipelineStages[0]?.id || '',
          assignedAgentId: contactData.assignedAgentId || '',
          tags: contactData.tags || [],
          customFields: contactData.customFields || {},
          source: contactData.source || '',
          notes: contactData.notes || ''
        });
      }
      // ✅ CORREÇÃO: Não fazer reload completo, apenas mostrar feedback
      toast.success(editingContact ? 'Contato atualizado!' : 'Contato criado!');
      setShowForm(false);
      setEditingContact(null);
    } catch (error) {
      console.error('❌ Error saving contact:', error);
      alert(`Erro ao salvar contato: ${error.message || error}`);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleDelete = async (contactId: string) => {
    if (confirm('Tem certeza que deseja excluir este contato?')) {
      try {
        await deleteContact(contactId);
        // ✅ CORREÇÃO: Atualização otimista - remove da UI imediatamente
        toast.success('Contato excluído!');
      } catch (error) {
        console.error('Error deleting contact:', error);
        toast.error('Erro ao excluir contato');
      }
    }
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setShowDetailPanel(true);
  };

  const handleCloseDetailPanel = () => {
    setShowDetailPanel(false);
    setSelectedContact(null);
  };

  const handleImportProgress = useCallback((progress: ImportProgress) => {
    console.log('📊 Import progress update:', progress);
    setImportProgress(progress);
    
    // ✅ CORREÇÃO: Controle melhorado de proteção contra recarregamento
    if (!progress.isComplete && progress.total > 0) {
      // Importação ativa - proteger contra recarregamento
      if (!isImportActive) {
        console.log('🔒 Ativando proteção contra recarregamento');
        setIsImportActive(true);
        setPreventPageUnload(true);
      }
    } else if (progress.isComplete) {
      // Importação completa - remover proteção após delay
      console.log('✅ Removendo proteção contra recarregamento');
      setTimeout(() => {
        setIsImportActive(false);
        setPreventPageUnload(false);
      }, 1000); // Delay para garantir que o usuário veja a conclusão
    }
  }, [isImportActive]);

  const handleCloseImport = useCallback(() => {
    // ✅ CORREÇÃO: Lógica melhorada para fechamento
    if (importProgress && !importProgress.isComplete) {
      console.log('⚠️ Tentativa de fechar importação em andamento - bloqueada');
      return;
    }
    
    console.log('🔓 Fechando popup e removendo todas as proteções');
    setImportProgress(null);
    setIsImportActive(false);
    setPreventPageUnload(false);
  }, [importProgress]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedList('');
    setSelectedStage('');
    setSelectedAgent('');
    setSelectedTags([]);
    setTagSearch('');
    setStartDate('');
    setEndDate('');
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === paginatedContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(paginatedContacts.map(c => c.id)));
    }
  };

  const handleBulkAction = async (action: string, value?: string) => {
    if (selectedContacts.size === 0) return;

    const contactIds = Array.from(selectedContacts);
    
    try {
      switch (action) {
        case 'moveToList':
          if (value) {
            await updateContacts(contactIds, { listId: value });
          }
          break;
        case 'moveToStage':
          if (value) {
            await updateContacts(contactIds, { stageId: value });
          }
          break;
        case 'addTags':
          if (value) {
            const tagIds = value.split(',');
            for (const contactId of contactIds) {
              const contact = data.contacts.find(c => c.id === contactId);
              if (contact) {
                const newTags = [...new Set([...contact.tags, ...tagIds])];
                await updateContact(contactId, { tags: newTags });
              }
            }
          }
          break;
        case 'delete':
          if (confirm(`Tem certeza que deseja excluir ${contactIds.length} contato(s)?`)) {
            for (const contactId of contactIds) {
              await deleteContact(contactId);
            }
          }
          break;
      }
      
      // ✅ CORREÇÃO: Feedback via toast em vez de reload
      toast.success(`Ação aplicada a ${contactIds.length} contato(s)`);
      setSelectedContacts(new Set());
      setShowBulkActions(false);
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Erro ao executar ação em massa');
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const filteredTags = data.tags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Import Progress Indicator */}
      {/* ✅ CORREÇÃO: Mostra se há progresso OU se está ativo */}
      {importProgress && (
        <ImportProgressIndicator
          isImporting={isImportActive && (!importProgress || !importProgress.isComplete)}
          progress={importProgress || { current: 0, total: 0, success: 0, errors: [], isComplete: false }}
          onCancel={handleCloseImport}
          onClose={handleCloseImport}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gerenciar Contatos</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </button>
          <button
            onClick={() => onExportFiltered(filteredContacts)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Filtrados ({filteredContacts.length})
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Contato
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lista
            </label>
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Todas as listas</option>
              {data.lists.map(list => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Etapa
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Todas as etapas</option>
              {data.pipelineStages.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </div>
          
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
                        {tag.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Nenhuma tag encontrada</p>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtro por Data de Criação
            </label>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Data inicial (a partir de):</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Data inicial"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <label className="text-xs text-gray-500">Data final (até):</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Data final"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              {/* CORREÇÃO 2: Indicador visual do filtro ativo */}
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
          
          <div className="flex items-end">
            {selectedContacts.size > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  Ações ({selectedContacts.size})
                </button>
                
                {showBulkActions && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm font-medium text-gray-900 border-b border-gray-200">
                        Mover para Lista
                      </div>
                      {data.lists.map(list => (
                        <button
                          key={list.id}
                          onClick={() => handleBulkAction('moveToList', list.id)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {list.name}
                        </button>
                      ))}
                      
                      <div className="px-4 py-2 text-sm font-medium text-gray-900 border-b border-t border-gray-200">
                        Mover para Etapa
                      </div>
                      {data.pipelineStages.map(stage => (
                        <button
                          key={stage.id}
                          onClick={() => handleBulkAction('moveToStage', stage.id)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {stage.name}
                        </button>
                      ))}
                      
                      <div className="border-t border-gray-200">
                        <button
                          onClick={() => {
                            const tagIds = prompt('Digite os IDs das tags separados por vírgula:');
                            if (tagIds) handleBulkAction('addTags', tagIds);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Adicionar Tags
                        </button>
                        <button
                          onClick={() => handleBulkAction('delete')}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          Excluir Contatos
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={clearFilters}
              className={`w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                selectedContacts.size > 0 ? 'ml-2' : ''
              } ${
                searchTerm || selectedList || selectedStage || selectedAgent || selectedTags.length > 0 || startDate || endDate
                  ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                  : 'text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              {searchTerm || selectedList || selectedStage || selectedAgent || selectedTags.length > 0 || startDate || endDate ? 'Limpar Filtros' : 'Filtros'}
            </button>
          </div>
        </div>
      </div>

      {/* Contact List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Contatos ({filteredContacts.length})
            </h3>
            
            {/* Pagination Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">Itens por página:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                  <option value={filteredContacts.length}>Todos ({filteredContacts.length})</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="text-sm text-gray-700">
                  Página {currentPage} de {totalPages} ({filteredContacts.length} total)
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={toggleSelectAll}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      {selectedContacts.size === paginatedContacts.length && paginatedContacts.length > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lista
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Etapa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Atendente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Criação
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedContacts.map(contact => {
                  const list = data.lists.find(l => l.id === contact.listId);
                  const stage = data.pipelineStages.find(s => s.id === contact.stageId);
                  const agent = data.agents.find(a => a.id === contact.assignedAgentId);
                  
                  return (
                    <tr key={contact.id} className="group hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleContactSelection(contact.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {selectedContacts.has(contact.id) ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => handleContactClick(contact)}
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-indigo-600">
                                {contact.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {contact.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {contact.email}
                            </div>
                            {contact.company && (
                              <div className="text-sm text-gray-500">
                                {contact.company}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: list?.color + '20',
                            color: list?.color
                          }}
                        >
                          {list?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: stage?.color + '20',
                            color: stage?.color
                          }}
                        >
                          {stage?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {agent?.name || 'Não atribuído'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.slice(-1).map(tagId => {
                            const tag = data.tags.find(t => t.id === tagId);
                            return tag ? (
                              <span
                                key={tagId}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: tag.color + '20',
                                  color: tag.color
                                }}
                              >
                                <TagIcon className="h-3 w-3 mr-1" />
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                          {contact.tags.length > 1 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              +{contact.tags.length - 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {contact.createdAt.toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ContactActions contact={contact} />
                          <button
                            onClick={() => handleEdit(contact)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Contact Form Modal */}
      {showForm && (
        <ContactForm
          contact={editingContact}
          data={data}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
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

      {/* CSV Import Modal */}
      {showImportModal && (
        <CSVImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          data={data}
          onDataChange={onDataChange}
          onStartImport={handleImportProgress}
        />
      )}
    </div>
  );
};

export default ContactManager;