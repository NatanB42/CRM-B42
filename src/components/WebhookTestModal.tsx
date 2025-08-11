import React, { useState } from 'react';
import { X, Send, CheckCircle, AlertCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { List, OutgoingWebhookConfig } from '../types';

interface WebhookTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  list: List;
}

const WebhookTestModal: React.FC<WebhookTestModalProps> = ({ isOpen, onClose, list }) => {
  const [selectedWebhook, setSelectedWebhook] = useState<OutgoingWebhookConfig | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [showPayload, setShowPayload] = useState(false);

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
      id: list.id,
      name: list.name,
    },
    assigned_agent: {
      id: 'sample-agent-id',
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      phone: '(11) 88888-8888',
      role: 'Vendedora'
    },
  };

  const testWebhook = async (webhook: OutgoingWebhookConfig) => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhook.headers,
        },
        body: JSON.stringify(samplePayload),
      });

      const responseText = await response.text();
      
      setTestResult({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        url: webhook.url
      });
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
        url: webhook.url
      });
    } finally {
      setTesting(false);
    }
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(samplePayload, null, 2));
  };

  if (!isOpen) return null;

  const activeWebhooks = (list.outgoingWebhooks || []).filter(w => w.enabled !== false && w.url);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
        
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Testar Webhooks de Saída
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Lista: {list.name} ({activeWebhooks.length} webhook(s) ativo(s))
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Webhook Selection */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Selecionar Webhook para Testar
              </h4>
              
              {activeWebhooks.length > 0 ? (
                <div className="space-y-2">
                  {activeWebhooks.map((webhook, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedWebhook === webhook
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedWebhook(webhook)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {webhook.url}
                          </p>
                          {webhook.headers && Object.keys(webhook.headers).length > 0 && (
                            <p className="text-xs text-gray-500">
                              {Object.keys(webhook.headers).length} cabeçalho(s) personalizado(s)
                            </p>
                          )}
                        </div>
                        <div className="ml-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ativo
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Send className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Nenhum webhook ativo configurado para esta lista</p>
                </div>
              )}

              {selectedWebhook && (
                <div className="mt-4">
                  <button
                    onClick={() => testWebhook(selectedWebhook)}
                    disabled={testing}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Testando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Testar Webhook
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Payload Preview and Results */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Payload de Exemplo
                </h4>
                <div className="flex space-x-2">
                  <button
                    onClick={copyPayload}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </button>
                  <button
                    onClick={() => setShowPayload(!showPayload)}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    {showPayload ? (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Ver JSON
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {showPayload && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap max-h-64">
                    {JSON.stringify(samplePayload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Test Results */}
              {testResult && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">
                    Resultado do Teste
                  </h4>
                  
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
                          <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
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
            </div>
          </div>

          <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookTestModal;