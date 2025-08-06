import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Users, Target, ArrowRight } from 'lucide-react';
import { List, CRMData, DistributionRule } from '../types';
import { createList, updateList, deleteList } from '../lib/database';

interface ListManagerProps {
  data: CRMData;
  onDataChange: () => void;
  onOpenListPipeline: (listId: string) => void;
}

const ListManager: React.FC<ListManagerProps> = ({ data, onDataChange, onOpenListPipeline }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingList, setEditingList] = useState<List | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    distributionRules: [] as DistributionRule[]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingList) {
        await updateList(editingList.id, formData);
      } else {
        await createList(formData);
      }
      onDataChange();
      resetForm();
    } catch (error) {
      console.error('Error saving list:', error);
      alert('Erro ao salvar lista');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      distributionRules: []
    });
    setShowForm(false);
    setEditingList(null);
  };

  const handleEdit = (list: List) => {
    setEditingList(list);
    setFormData({
      name: list.name,
      description: list.description,
      color: list.color,
      distributionRules: list.distributionRules || []
    });
    setShowForm(true);
  };

  const handleDelete = async (listId: string) => {
    const contactsInList = data.contacts.filter(contact => contact.listId === listId);
    
    if (contactsInList.length > 0) {
      alert(`Não é possível excluir esta lista pois ela contém ${contactsInList.length} contato(s).`);
      return;
    }
    
    if (confirm('Tem certeza que deseja excluir esta lista?')) {
      try {
        await deleteList(listId);
        onDataChange();
      } catch (error) {
        console.error('Error deleting list:', error);
        alert('Erro ao excluir lista');
      }
    }
  };

  const getContactCount = (listId: string) => {
    return data.contacts.filter(contact => contact.listId === listId).length;
  };

  const updateDistributionRule = (agentId: string, percentage: number) => {
    const existingRules = formData.distributionRules.filter(rule => rule.agentId !== agentId);
    const newRules = percentage > 0 
      ? [...existingRules, { agentId, percentage }]
      : existingRules;
    
    setFormData({ ...formData, distributionRules: newRules });
  };

  const getAgentPercentage = (agentId: string) => {
    const rule = formData.distributionRules.find(rule => rule.agentId === agentId);
    return rule ? rule.percentage : 0;
  };

  const getTotalPercentage = () => {
    return formData.distributionRules.reduce((sum, rule) => sum + rule.percentage, 0);
  };

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gerenciar Listas</h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Lista
        </button>
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.lists.map(list => (
          <div key={list.id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded-full mr-3"
                    style={{ backgroundColor: list.color }}
                  />
                  <h3 className="text-lg font-medium text-gray-900">
                    {list.name}
                  </h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(list);
                    }}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(list.id);
                    }}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-4">
                {list.description}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {getContactCount(list.id)} contato(s)
                </div>
                <div className="flex items-center">
                  <Target className="h-4 w-4 mr-1" />
                  {(list.distributionRules || []).length} regra(s)
                </div>
              </div>

              <button
                onClick={() => onOpenListPipeline(list.id)}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Abrir Funil
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingList ? 'Editar Lista' : 'Nova Lista'}
                </h3>
                <button
                  onClick={resetForm}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Lista *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cor
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`w-8 h-8 rounded-full border-2 ${
                            formData.color === color ? 'border-gray-900' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                {/* Distribution Rules */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Distribuição de Atendentes
                    </label>
                    <span className="text-sm text-gray-500">
                      Total: {getTotalPercentage()}%
                    </span>
                  </div>
                  
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {data.agents.filter(agent => agent.isActive).map(agent => (
                      <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {agent.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {agent.email}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={getAgentPercentage(agent.id)}
                            onChange={(e) => updateDistributionRule(agent.id, parseInt(e.target.value) || 0)}
                            className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {getTotalPercentage() !== 100 && getTotalPercentage() > 0 && (
                    <p className="mt-2 text-sm text-amber-600">
                      Atenção: A soma das porcentagens deve ser 100% para distribuição adequada.
                    </p>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {editingList ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListManager;