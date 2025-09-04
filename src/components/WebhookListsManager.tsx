import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Send, ToggleLeft, ToggleRight, Globe, AlertCircle, CheckCircle, Copy, Eye, EyeOff, X, Bug } from 'lucide-react';
import { List, CRMData, OutgoingWebhookConfig } from '../types';
import { updateList } from '../lib/database';
import { useToast } from '../hooks/useToast';
import WebhookDebugPanel from './WebhookDebugPanel';

interface WebhookListsManagerProps {
  data: CRMData;
  onDataChange: () => void;
}

const WebhookListsManager: React.FC<WebhookListsManagerProps> = ({ data, onDataChange }) => {
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<{ listId: string; index: number } | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<{ listId: string; index: number } | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    enabled: true,
    headers: {} as Record<string, string>
  });
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  
  const toast = useToast();

  const samplePayload = {
    event: 'contact_added_to_list',
    timestamp: new Date().toISOString(),
    contact: {
      id: 'sample-contact-id',
      name: 'João Silva',
      email: 'joao@exemplo.com',
      phone: '(11) 99999-9999',
      company: 'Empresa XYZ',
      instagram: '@joaosilva',
      source: 'Website',
      notes: 'Lead interessado em nossos serviços',
      custom_fields: {
        'campo_personalizado': 'valor_exemplo'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    list: {
      id: selectedList?.id || 'sample-list-id',
      name: selectedList?.name || 'Lista de Exemplo',
    },
    assigned_agent: {
      id: 'sample-agent-id',
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      phone: '(11) 88888-8888',
      role: 'Vendedora'
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedList) return;
    
    if (!formData.url.trim()) {
      toast.error('URL do webhook é obrigatória');
      return;
    }

    try {
      const currentWebhooks = selectedList.outgoingWebhooks || [];
      let newWebhooks: OutgoingWebhookConfig[];

      if (editingWebhook) {
        // Update existing webhook
        newWebhooks = [...currentWebhooks];
        newWebhooks[editingWebhook.index] = formData;
      } else {
        // Add new webhook
        newWebhooks = [...currentWebhooks, formData];
      }

      await updateList(selectedList.id, { outgoingWebhooks: newWebhooks });
      onDataChange();
      resetForm();
      toast.success(editingWebhook ? 'Webhook atualizado!' : 'Webhook adicionado!');
    } catch (error) {
      console.error('Error saving webhook:', error);
      toast.error('Erro ao salvar webhook');
    }
  };

  const resetForm = () => {
    setFormData({
      url: '',
      enabled: true,
      headers: {}
    });
    setNewHeaderKey('');
    setNewHeaderValue('');
    setShowForm(false);
    setEditingWebhook(null);
  };

  const handleEdit = (listId: string, index: number) => {
    const list = data.lists.find(l => l.id === listId);
    if (!list || !list.outgoingWebhooks) return;

    const webhook = list.outgoingWebhooks[index];
    setSelectedList(list);
    setEditingWebhook({ listId, index });
    setFormData({
      url: webhook.url,
      enabled: webhook.enabled !== false,
      headers: webhook.headers || {}
    });
    setShowForm(true);
  };

  const handleDelete = async (listId: string, index: number) => {
    const list = data.lists.find(l => l.id === listId);
    if (!list || !list.outgoingWebhooks) return;

    if (confirm('Tem certeza que deseja excluir este webhook?')) {
      try {
        const newWebhooks = list.outgoingWebhooks.filter((_, i) => i !== index);
        await updateList(listId, { outgoingWebhooks: newWebhooks });
        onDataChange();
        toast.success('Webhook excluído!');
      } catch (error) {
        console.error('Error deleting webhook:', error);
        toast.error('Erro ao excluir webhook');
      }
    }
  };

  const handleToggleEnabled = async (listId: string, index: number) => {
    const list = data.lists.find(l => l.id === listId);
    if (!list || !list.outgoingWebhooks) return;

    try {
      const newWebhooks = [...list.outgoingWebhooks];
      newWebhooks[index] = {
        ...newWebhooks[index],
        enabled: !newWebhooks[index].enabled
      };

      await updateList(listId, { outgoingWebhooks: newWebhooks });
      onDataChange();
      toast.success(newWebhooks[index].enabled ? 'Webhook ativado!' : 'Webhook desativado!');
    } catch (error) {
      console.error('Error toggling webhook:', error);
      toast.error('Erro ao alterar status do webhook');
    }
  };

  const testWebhook = async (listId: string, index: number) => {
    const list = data.lists.find(l => l.id === listId);
    if (!list || !list.outgoingWebhooks) return;

    const webhook = list.outgoingWebhooks[index];
    setTestingWebhook({ listId, index });
    setTestResult(null);

    console.log('🧪 Testando webhook:', webhook.url);
    console.log('📦 Payload de teste:', samplePayload);
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CRM-B42-Test/1.0',
          'X-Webhook-Source': 'CRM-B42-Test',
          'X-Event-Type': 'test',
          ...webhook.headers,
        },
        body: JSON.stringify({
          ...samplePayload,
          list: {
            id: listId,
            name: list.name
          },
          test: true,
          test_timestamp: new Date().toISOString()
        }),
      });

      const responseText = await response.text();
      
      console.log('📨 Resposta do teste:', {
        status: response.status,
        statusText: response.statusText,
        response: responseText
      });
      
      setTestResult({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        url: webhook.url
      });
    } catch (error) {
      console.error('❌ Erro no teste do webhook:', error);
      setTestResult({
        success: false,
        error: error.message,
        url: webhook.url
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const addHeader = () => {
    if (newHeaderKey.trim() && newHeaderValue.trim()) {
      setFormData({
        ...formData,
        headers: {
          ...formData.headers,
          [newHeaderKey.trim()]: newHeaderValue.trim()
        }
      });
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...formData.headers };
    delete newHeaders[key];
    setFormData({ ...formData, headers: newHeaders });
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(samplePayload, null, 2));
    toast.success('Payload copiado!');
  };

  const getWebhookCount = (list: List) => {
    return (list.outgoingWebhooks || []).length;
  };

  const getActiveWebhookCount = (list: List) => {
    return (list.outgoingWebhooks || []).filter(w => w.enabled !== false).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Webhooks por Lista</h2>
          <p className="mt-1 text-sm text-gray-600">
            Configure webhooks de saída para enviar dados de contatos automaticamente para sistemas externos
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowDebugPanel(true)}
            className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md shadow-sm text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <Bug className="h-4 w-4 mr-2" />
            Debug Webhooks
          </button>
          {selectedList && (
            <button
              onClick={() => {
                setSelectedList(selectedList);
                setShowForm(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Webhook
            </button>
          )}
        </div>
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.lists.map(list => (
          <div 
            key={list.id} 
            className={`bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow cursor-pointer ${
              selectedList?.id === list.id ? 'ring-2 ring-indigo-500' : ''
            }`}
            onClick={() => setSelectedList(list)}
          >
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
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {getActiveWebhookCount(list)}/{getWebhookCount(list)}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-4">
                {list.description || 'Sem descrição'}
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total de webhooks:</span>
                  <span className="font-medium">{getWebhookCount(list)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Webhooks ativos:</span>
                  <span className={`font-medium ${getActiveWebhookCount(list) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {getActiveWebhookCount(list)}
                  </span>
                </div>
              </div>

              {getWebhookCount(list) === 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Nenhum webhook configurado</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected List Webhooks */}
      {selectedList && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <div
                    className="w-4 h-4 rounded-full mr-3"
                    style={{ backgroundColor: selectedList.color }}
                  />
                  Webhooks - {selectedList.name}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Gerencie os webhooks de saída para esta lista
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Webhook
              </button>
            </div>

            {/* Webhooks List */}
            {(selectedList.outgoingWebhooks || []).length > 0 ? (
              <div className="space-y-4">
                {(selectedList.outgoingWebhooks || []).map((webhook, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleToggleEnabled(selectedList.id, index)}
                          className="inline-flex items-center"
                        >
                          {webhook.enabled !== false ? (
                            <ToggleRight className="h-6 w-6 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-gray-400" />
                          )}
                        </button>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 break-all">
                            {webhook.url}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              webhook.enabled !== false 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {webhook.enabled !== false ? 'Ativo' : 'Inativo'}
                            </span>
                            {webhook.headers && Object.keys(webhook.headers).length > 0 && (
                              <span className="text-xs text-gray-500">
                                {Object.keys(webhook.headers).length} cabeçalho(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => testWebhook(selectedList.id, index)}
                          disabled={testingWebhook?.listId === selectedList.id && testingWebhook?.index === index}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="Testar webhook"
                        >
                          {testingWebhook?.listId === selectedList.id && testingWebhook?.index === index ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(selectedList.id, index)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Editar webhook"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(selectedList.id, index)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir webhook"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Headers Display */}
                    {webhook.headers && Object.keys(webhook.headers).length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-700 mb-2">Cabeçalhos HTTP:</p>
                        <div className="space-y-1">
                          {Object.entries(webhook.headers).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="font-mono text-gray-600">{key}:</span>
                              <span className="font-mono text-gray-800 truncate ml-2">
                                {key.toLowerCase().includes('authorization') || key.toLowerCase().includes('token') 
                                  ? '***' 
                                  : value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Send className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Nenhum webhook configurado para esta lista</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Webhook
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resultado do Teste</h3>
          
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-2">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              <span className={`text-sm font-medium ${
                testResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {testResult.success ? 'Webhook enviado com sucesso!' : 'Falha no webhook'}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">URL:</span> {testResult.url}
              </div>
              {testResult.status && (
                <div>
                  <span className="font-medium">Status:</span> {testResult.status} {testResult.statusText}
                </div>
              )}
              {testResult.response && (
                <div>
                  <span className="font-medium">Resposta:</span>
                  <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto max-h-32">
                    {testResult.response}
                  </pre>
                </div>
              )}
              {testResult.error && (
                <div>
                  <span className="font-medium text-red-700">Erro:</span> {testResult.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payload Preview */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Payload Enviado pelos Webhooks
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={copyPayload}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </button>
            <button
              onClick={() => setShowPayload(!showPayload)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {showPayload ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ocultar
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Ver JSON
                </>
              )}
            </button>
          </div>
        </div>
        
        {showPayload && (
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-h-96">
              {JSON.stringify(samplePayload, null, 2)}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Quando os Webhooks são Disparados</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Quando um novo contato é adicionado à lista</li>
              <li>Quando um contato é movido para a lista</li>
              <li>Quando o vendedor atribuído ao contato é alterado</li>
            </ul>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-900 mb-2">Recursos Disponíveis</h4>
            <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
              <li>Múltiplos webhooks por lista</li>
              <li>Cabeçalhos HTTP personalizados</li>
              <li>Ativar/desativar individualmente</li>
              <li>Teste de webhooks integrado</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && selectedList && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
                </h3>
                <button
                  onClick={resetForm}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL do Webhook *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                    placeholder="https://exemplo.com/webhook"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    URL que receberá os dados do contato via POST
                  </p>
                </div>

                <div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Webhook ativo</span>
                  </label>
                </div>

                {/* Custom Headers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Cabeçalhos HTTP Personalizados
                  </label>
                  
                  {/* Existing Headers */}
                  {Object.keys(formData.headers).length > 0 && (
                    <div className="space-y-2 mb-4">
                      {Object.entries(formData.headers).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <span className="text-sm font-mono text-gray-700 flex-1">{key}:</span>
                          <span className="text-sm font-mono text-gray-900 flex-1 truncate">
                            {key.toLowerCase().includes('authorization') || key.toLowerCase().includes('token') 
                              ? '***' 
                              : value}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeHeader(key)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Header */}
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={newHeaderKey}
                        onChange={(e) => setNewHeaderKey(e.target.value)}
                        placeholder="Nome do cabeçalho"
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={newHeaderValue}
                        onChange={(e) => setNewHeaderValue(e.target.value)}
                        placeholder="Valor"
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addHeader}
                      disabled={!newHeaderKey.trim() || !newHeaderValue.trim()}
                      className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Exemplos comuns:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li><code>Authorization: Bearer seu_token</code></li>
                      <li><code>X-API-Key: sua_api_key</code></li>
                      <li><code>X-Custom-Header: valor_personalizado</code></li>
                    </ul>
                  </div>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">Importante</h4>
                      <p className="mt-1 text-sm text-yellow-700">
                        O webhook será disparado automaticamente quando contatos forem adicionados a esta lista 
                        ou quando o vendedor atribuído for alterado. Certifique-se de que a URL está correta 
                        e pode receber requisições POST.
                      </p>
                    </div>
                  </div>
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
                    {editingWebhook ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <WebhookDebugPanel
        isOpen={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
      />
    </div>
  );
};

  const handleToggleEnabled = async (listId: string, index: number) => {
    const list = data.lists.find(l => l.id === listId);
    if (!list || !list.outgoingWebhooks) return;

    try {
      const newWebhooks = [...list.outgoingWebhooks];
      newWebhooks[index] = {
        ...newWebhooks[index],
        enabled: !newWebhooks[index].enabled
      };

      await updateList(listId, { outgoingWebhooks: newWebhooks });
      onDataChange();
      toast.success(newWebhooks[index].enabled ? 'Webhook ativado!' : 'Webhook desativado!');
    } catch (error) {
      console.error('Error toggling webhook:', error);
      toast.error('Erro ao alterar status do webhook');
    }
  };

  const handleDelete = async (listId: string, index: number) => {
    const list = data.lists.find(l => l.id === listId);
    if (!list || !list.outgoingWebhooks) return;

    if (confirm('Tem certeza que deseja excluir este webhook?')) {
      try {
        const newWebhooks = list.outgoingWebhooks.filter((_, i) => i !== index);
        await updateList(listId, { outgoingWebhooks: newWebhooks });
        onDataChange();
        toast.success('Webhook excluído!');
      } catch (error) {
        console.error('Error deleting webhook:', error);
        toast.error('Erro ao excluir webhook');
      }
    }
  };

export default WebhookListsManager;