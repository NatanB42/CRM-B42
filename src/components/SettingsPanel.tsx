import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Tag as TagIcon, Settings, Globe, Copy, Check } from 'lucide-react';
import { Tag, CustomField, CRMData } from '../types';
import { createTag, updateTag, deleteTag, createCustomField, updateCustomField, deleteCustomField } from '../lib/database';

interface SettingsPanelProps {
  data: CRMData;
  onDataChange: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ data, onDataChange }) => {
  const [activeTab, setActiveTab] = useState('tags');
  const [showTagForm, setShowTagForm] = useState(false);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [tagForm, setTagForm] = useState({
    name: '',
    color: '#3B82F6',
    description: ''
  });
  
  const [fieldForm, setFieldForm] = useState({
    name: '',
    type: 'text' as CustomField['type'],
    required: false,
    placeholder: '',
    options: [] as string[]
  });

  const [newOption, setNewOption] = useState('');

  // Generate webhook URL - using Supabase Edge Function
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/webhook-contacts`;
  
  const webhookExample = {
    url: webhookUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
    },
    body: {
      name: "João Silva",
      email: "joao@exemplo.com",
      phone: "(11) 99999-9999",
      company: "Empresa XYZ",
      source: "Website",
      listId: data.lists[0]?.id || "",
      customFields: {
        "campo1": "valor1"
      }
    }
  };

  const outgoingWebhookExample = {
    event: 'contact_added_to_list',
    timestamp: new Date().toISOString(),
    contact: {
      id: 'contact-uuid',
      name: 'João Silva',
      email: 'joao@exemplo.com',
      phone: '(11) 99999-9999',
      company: 'Empresa XYZ',
      instagram: '@joaosilva',
      source: 'Website',
      notes: 'Lead interessado',
      custom_fields: { campo1: 'valor1' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    list: {
      id: 'list-uuid',
      name: 'Leads Gerais'
    },
    assigned_agent: {
      id: 'agent-uuid',
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      phone: '(11) 88888-8888',
      role: 'Vendedora'
    }
  };

  // Tag management
  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTag) {
        await updateTag(editingTag.id, tagForm);
      } else {
        await createTag(tagForm);
      }
      onDataChange();
      resetTagForm();
    } catch (error) {
      console.error('Error saving tag:', error);
      alert('Erro ao salvar tag');
    }
  };

  const resetTagForm = () => {
    setTagForm({
      name: '',
      color: '#3B82F6',
      description: ''
    });
    setShowTagForm(false);
    setEditingTag(null);
  };

  const handleTagEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagForm({
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    });
    setShowTagForm(true);
  };

  const handleTagDelete = async (tagId: string) => {
    if (confirm('Tem certeza que deseja excluir esta tag?')) {
      try {
        await deleteTag(tagId);
        onDataChange();
      } catch (error) {
        console.error('Error deleting tag:', error);
        alert('Erro ao excluir tag');
      }
    }
  };

  // Custom field management
  const handleFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Block Instagram field creation
    if (fieldForm.name.toLowerCase().includes('instagram') || fieldForm.type === 'instagram') {
      alert('Não é possível criar campos personalizados do Instagram. Use o campo nativo do Instagram no formulário de contatos.');
      return;
    }
    
    try {
      if (editingField) {
        await updateCustomField(editingField.id, fieldForm);
      } else {
        await createCustomField(fieldForm);
      }
      onDataChange();
      resetFieldForm();
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Erro ao salvar campo');
    }
  };

  const resetFieldForm = () => {
    setFieldForm({
      name: '',
      type: 'text',
      required: false,
      placeholder: '',
      options: []
    });
    setShowFieldForm(false);
    setEditingField(null);
  };

  const handleFieldEdit = (field: CustomField) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder || '',
      options: field.options || []
    });
    setShowFieldForm(true);
  };

  const handleFieldDelete = async (fieldId: string) => {
    if (confirm('Tem certeza que deseja excluir este campo?')) {
      try {
        await deleteCustomField(fieldId);
        onDataChange();
      } catch (error) {
        console.error('Error deleting field:', error);
        alert('Erro ao excluir campo');
      }
    }
  };

  const addOption = () => {
    if (newOption.trim()) {
      setFieldForm({
        ...fieldForm,
        options: [...fieldForm.options, newOption.trim()]
      });
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setFieldForm({
      ...fieldForm,
      options: fieldForm.options.filter((_, i) => i !== index)
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const testWebhook = async () => {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          ...webhookExample.body,
          instagram: '@usuario_teste'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Webhook de teste enviado com sucesso! Verifique a lista de contatos.');
        onDataChange();
      } else {
        alert(`Erro no webhook: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert('Erro ao testar webhook. Certifique-se de que a Edge Function está ativa.');
    }
  };

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  const fieldTypes = [
    { value: 'text', label: 'Texto' },
    { value: 'textarea', label: 'Texto Longo' },
    { value: 'select', label: 'Seleção' },
    { value: 'number', label: 'Número' },
    { value: 'currency', label: 'Moeda' },
    { value: 'date', label: 'Data' },
    { value: 'checkbox', label: 'Checkbox' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tags')}
            className={`${
              activeTab === 'tags'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <TagIcon className="h-4 w-4 mr-2" />
            Tags
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`${
              activeTab === 'fields'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Settings className="h-4 w-4 mr-2" />
            Campos Personalizados
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`${
              activeTab === 'integrations'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Globe className="h-4 w-4 mr-2" />
            Webhooks
          </button>
        </nav>
      </div>

      {/* Tags Tab */}
      {activeTab === 'tags' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Tags</h3>
            <button
              onClick={() => setShowTagForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Tag
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.tags.map(tag => (
              <div key={tag.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    <h4 className="text-sm font-medium text-gray-900">{tag.name}</h4>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleTagEdit(tag)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleTagDelete(tag.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {tag.description && (
                  <p className="text-sm text-gray-500">{tag.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Fields Tab */}
      {activeTab === 'fields' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Campos Personalizados</h3>
            <button
              onClick={() => setShowFieldForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Campo
            </button>
          </div>
          
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {data.customFields.map(field => (
                <li key={field.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">
                          {field.name}
                        </h4>
                        {field.required && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Tipo: {fieldTypes.find(t => t.value === field.type)?.label}
                      </p>
                      {field.placeholder && (
                        <p className="text-sm text-gray-500">
                          Placeholder: {field.placeholder}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleFieldEdit(field)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleFieldDelete(field.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Webhook Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Configuração de Webhooks</h3>
          
          {/* Incoming Webhooks */}
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Webhook de Entrada (Receber Contatos)
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Use esta URL para receber contatos de formulários externos, Zapier ou outras integrações.
              </p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL do Webhook de Entrada
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    readOnly
                    className="flex-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookUrl)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Envie dados de contatos via POST para esta URL.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Exemplo de Requisição</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
{`POST ${webhookUrl}
Content-Type: application/json
Authorization: Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}

${JSON.stringify(webhookExample.body, null, 2)}`}
                  </pre>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Campos Disponíveis</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="text-sm">
                    <span className="font-medium">name*:</span> Nome do contato
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">email*:</span> Email do contato
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">phone:</span> Telefone
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">company:</span> Empresa
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">source:</span> Fonte do lead
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">listId:</span> ID da lista 
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">customFields:</span> Campos personalizados
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">notes:</span> Observações
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">instagram:</span> Instagram (@usuario)
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">* Campos obrigatórios</p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={testWebhook}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Testar Webhook
                </button>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(webhookExample.body, null, 2))}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Copiar Exemplo
                </button>
              </div>
            </div>
          </div>

          {/* Outgoing Webhooks */}
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Webhooks de Saída (Enviar Dados)
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Configure webhooks de saída nas listas para enviar dados de contatos automaticamente para sistemas externos quando contatos são adicionados ou atualizados.
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-blue-900 mb-2">Como Configurar Webhooks de Saída</h5>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Vá para a aba "Listas" no menu lateral</li>
                <li>Edite uma lista existente ou crie uma nova</li>
                <li>Na seção "Webhooks de Saída", adicione as URLs desejadas</li>
                <li>Marque como "Ativo" os webhooks que devem receber dados</li>
                <li>Salve a lista</li>
              </ol>
            </div>

            <div>
              <h5 className="text-sm font-medium text-gray-900 mb-3">Payload Enviado pelos Webhooks de Saída</h5>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(outgoingWebhookExample, null, 2)}
                </pre>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-yellow-900 mb-2">Quando os Webhooks são Disparados</h5>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Quando um novo contato é adicionado à lista</li>
                <li>Quando um contato é movido para a lista</li>
                <li>Quando o vendedor atribuído ao contato é alterado</li>
              </ul>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-green-900 mb-2">Recursos dos Webhooks de Saída</h5>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li>Múltiplos webhooks por lista</li>
                <li>Cabeçalhos HTTP personalizados</li>
                <li>Ativar/desativar individualmente</li>
                <li>Dados completos do contato e vendedor</li>
                <li>Processamento automático via triggers</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tag Form Modal */}
      {showTagForm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingTag ? 'Editar Tag' : 'Nova Tag'}
                </h3>
                <button
                  onClick={resetTagForm}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleTagSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Tag *
                  </label>
                  <input
                    type="text"
                    value={tagForm.name}
                    onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                    required
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={tagForm.description}
                    onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                    rows={3}
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
                        onClick={() => setTagForm({ ...tagForm, color })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          tagForm.color === color ? 'border-gray-900' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetTagForm}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {editingTag ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Custom Field Form Modal */}
      {showFieldForm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingField ? 'Editar Campo' : 'Novo Campo'}
                </h3>
                <button
                  onClick={resetFieldForm}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleFieldSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Campo *
                  </label>
                  <input
                    type="text"
                    value={fieldForm.name}
                    onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                    required
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo do Campo *
                  </label>
                  <select
                    value={fieldForm.type}
                    onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value as CustomField['type'] })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    {fieldTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={fieldForm.placeholder}
                    onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                {fieldForm.type === 'select' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Opções
                    </label>
                    <div className="space-y-2">
                      {fieldForm.options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={option}
                            readOnly
                            className="flex-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          placeholder="Nova opção"
                          className="flex-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={addOption}
                          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={fieldForm.required}
                      onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Campo obrigatório</span>
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetFieldForm}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {editingField ? 'Salvar' : 'Criar'}
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

export default SettingsPanel;