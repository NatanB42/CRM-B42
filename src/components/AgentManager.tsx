import React, { useState } from 'react';
import { Plus, Edit2, Trash2, User, Mail, Phone, ToggleLeft, ToggleRight } from 'lucide-react';
import { Agent, CRMData } from '../types';
import { createAgent, updateAgent, deleteAgent } from '../lib/database';

interface AgentManagerProps {
  data: CRMData;
  onDataChange: () => void;
}

const AgentManager: React.FC<AgentManagerProps> = ({ data, onDataChange }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    isActive: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, formData);
      } else {
        await createAgent(formData);
      }
      onDataChange();
      resetForm();
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('Erro ao salvar atendente');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: '',
      isActive: true
    });
    setShowForm(false);
    setEditingAgent(null);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      role: agent.role || '',
      isActive: agent.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (agentId: string) => {
    const contactsAssigned = data.contacts.filter(contact => contact.assignedAgentId === agentId);
    
    if (contactsAssigned.length > 0) {
      alert(`Não é possível excluir este atendente pois ele tem ${contactsAssigned.length} contato(s) atribuído(s).`);
      return;
    }
    
    if (confirm('Tem certeza que deseja excluir este atendente?')) {
      try {
        await deleteAgent(agentId);
        onDataChange();
      } catch (error) {
        console.error('Error deleting agent:', error);
        alert('Erro ao excluir atendente');
      }
    }
  };

  const toggleAgentStatus = async (agentId: string) => {
    const agent = data.agents.find(a => a.id === agentId);
    if (agent) {
      try {
        await updateAgent(agentId, { isActive: !agent.isActive });
        onDataChange();
      } catch (error) {
        console.error('Error updating agent status:', error);
        alert('Erro ao atualizar status do atendente');
      }
    }
  };

  const getContactCount = (agentId: string) => {
    // Get the "Fechado" stage
    const closedStage = data.pipelineStages.find(stage => 
      stage.name.toLowerCase().includes('fechado') || 
      stage.order === Math.max(...data.pipelineStages.map(s => s.order))
    );
    
    // Filter out closed contacts from agent count
    return data.contacts.filter(contact => 
      contact.assignedAgentId === agentId && 
      (!closedStage || contact.stageId !== closedStage.id)
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciar Atendentes</h2>
          <p className="mt-1 text-sm text-gray-600">
            Configure atendentes e suas distribuições por lista
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Atendente
        </button>
      </div>

      {/* Agents List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {data.agents.map(agent => {
            return (
              <li key={agent.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-12">
                      <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                        <User className="h-6 w-6 text-indigo-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {agent.name}
                        </div>
                        <div className="ml-2">
                          <button
                            onClick={() => toggleAgentStatus(agent.id)}
                            className="inline-flex items-center"
                          >
                            {agent.isActive ? (
                              <ToggleRight className="h-5 w-5 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">{agent.email}</div>
                      {agent.phone && (
                        <div className="text-sm text-gray-500">{agent.phone}</div>
                      )}
                      {agent.role && (
                        <div className="text-sm text-gray-500">{agent.role}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {getContactCount(agent.id)} contatos
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {agent.email && (
                        <a
                          href={`mailto:${agent.email}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {agent.phone && (
                        <a
                          href={`tel:${agent.phone}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleEdit(agent)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingAgent ? 'Editar Atendente' : 'Novo Atendente'}
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
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome *
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
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Ativo</span>
                  </label>
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
                    {editingAgent ? 'Salvar' : 'Criar'}
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

export default AgentManager;