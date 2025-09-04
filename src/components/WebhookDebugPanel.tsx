import React, { useState, useEffect } from 'react';
import { Bug, Play, RefreshCw, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

interface WebhookLog {
  id: string;
  event_type: string;
  webhook_url: string;
  contact_email: string;
  list_name: string;
  status: 'success' | 'error' | 'pending';
  response_status?: number;
  error_message?: string;
  created_at: string;
}

interface WebhookDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const WebhookDebugPanel: React.FC<WebhookDebugPanelProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingContact, setTestingContact] = useState('');
  const toast = useToast();

  const loadWebhookLogs = async () => {
    setLoading(true);
    try {
      // Simular logs de webhook (em produção, isso viria de uma tabela de logs)
      const mockLogs: WebhookLog[] = [
        {
          id: '1',
          event_type: 'contact_added_to_list',
          webhook_url: 'https://exemplo.com/webhook',
          contact_email: 'teste@exemplo.com',
          list_name: 'Lista Teste',
          status: 'success',
          response_status: 200,
          created_at: new Date().toISOString()
        }
      ];
      setLogs(mockLogs);
    } catch (error) {
      console.error('Error loading webhook logs:', error);
      toast.error('Erro ao carregar logs de webhook');
    } finally {
      setLoading(false);
    }
  };

  const testWebhookTrigger = async () => {
    if (!testingContact.trim()) {
      toast.error('Digite um email de contato para testar');
      return;
    }

    try {
      // Buscar contato pelo email
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', testingContact.trim())
        .limit(1);

      if (error) throw error;

      if (!contacts || contacts.length === 0) {
        toast.error('Contato não encontrado');
        return;
      }

      const contact = contacts[0];

      // Usar função de simulação de webhook
      const { data: simulationResult, error: simError } = await supabase
        .rpc('simulate_webhook_for_contact', {
          contact_email: testingContact.trim(),
          event_type: 'manual_test'
        });

      if (simError) throw simError;

      console.log('Resultado da simulação:', simulationResult);
      
      if (simulationResult?.success) {
        toast.success(`Webhook simulado! ${simulationResult.webhooks_to_send} webhook(s) processado(s)`);
      } else {
        toast.error(`Erro na simulação: ${simulationResult?.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Error testing webhook trigger:', error);
      toast.error('Erro ao testar trigger de webhook');
    }
  };

  const checkTriggerStatus = async () => {
    try {
      // Verificar triggers e configuração de webhooks
      const [triggersResult, webhooksResult] = await Promise.all([
        supabase.rpc('check_webhook_triggers'),
        supabase.rpc('check_list_webhooks')
      ]);

      if (triggersResult.error || webhooksResult.error) {
        console.error('Error checking status:', triggersResult.error || webhooksResult.error);
        toast.error('Erro ao verificar status dos triggers');
        return;
      }

      console.log('=== STATUS DOS WEBHOOKS ===');
      console.log('Triggers ativos:', triggersResult.data);
      console.log('Listas com webhooks:', webhooksResult.data);
      
      const activeWebhooks = webhooksResult.data?.reduce((sum: number, list: any) => sum + list.active_webhook_count, 0) || 0;
      
      toast.success(`${triggersResult.data?.length || 0} triggers ativos, ${activeWebhooks} webhooks configurados`);
    } catch (error) {
      console.error('Error checking trigger status:', error);
      toast.error('Erro ao verificar triggers');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWebhookLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
        
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Bug className="h-6 w-6 text-orange-500 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Debug de Webhooks de Saída
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Test Controls */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-3">Testar Triggers de Webhook</h4>
              
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={testingContact}
                    onChange={(e) => setTestingContact(e.target.value)}
                    placeholder="Email do contato para testar"
                    className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <button
                    onClick={testWebhookTrigger}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Testar
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={checkTriggerStatus}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Bug className="h-4 w-4 mr-2" />
                    Verificar Triggers
                  </button>
                  <button
                    onClick={loadWebhookLogs}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar Logs
                  </button>
                </div>
              </div>
            </div>

            {/* Webhook Logs */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Logs de Webhooks Recentes
              </h4>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando logs...</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {log.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {log.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                          {log.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                          <span className="text-sm font-medium text-gray-900">
                            {log.event_type}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div><strong>URL:</strong> {log.webhook_url}</div>
                        <div><strong>Contato:</strong> {log.contact_email}</div>
                        <div><strong>Lista:</strong> {log.list_name}</div>
                        {log.response_status && (
                          <div><strong>Status:</strong> {log.response_status}</div>
                        )}
                        {log.error_message && (
                          <div className="text-red-600"><strong>Erro:</strong> {log.error_message}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Send className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Nenhum log de webhook encontrado</p>
                  <p className="text-xs mt-1">
                    Os logs aparecerão aqui quando webhooks forem disparados
                  </p>
                </div>
              )}
            </div>

            {/* Troubleshooting Guide */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-900 mb-3">
                Guia de Solução de Problemas
              </h4>
              
              <div className="space-y-2 text-sm text-yellow-800">
                <div className="flex items-start">
                  <span className="font-medium mr-2">1.</span>
                  <span>Verifique se a Edge Function "send-contact-webhook" está ativa no Supabase</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium mr-2">2.</span>
                  <span>Confirme se os triggers estão criados na tabela "contacts"</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium mr-2">3.</span>
                  <span>Verifique se a lista tem webhooks configurados e ativos</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium mr-2">4.</span>
                  <span>Teste manualmente usando o botão "Testar" acima</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium mr-2">5.</span>
                  <span>Verifique os logs do Supabase em Functions > send-contact-webhook > Logs</span>
                </div>
              </div>
            </div>

            {/* SQL Commands for Manual Debugging */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Comandos SQL para Debug Manual
              </h4>
              
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <p className="text-gray-600 mb-1">Verificar triggers ativos:</p>
                  <code className="block bg-white p-2 rounded border">
                    SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%webhook%';
                  </code>
                </div>
                
                <div>
                  <p className="text-gray-600 mb-1">Testar webhook para um contato específico:</p>
                  <code className="block bg-white p-2 rounded border">
                    SELECT simulate_webhook_for_contact('email@exemplo.com', 'manual_test');
                  </code>
                </div>
                
                <div>
                  <p className="text-gray-600 mb-1">Verificar configuração de webhooks:</p>
                  <code className="block bg-white p-2 rounded border">
                    SELECT * FROM check_list_webhooks();
                  </code>
                </div>
                
                <div>
                  <p className="text-gray-600 mb-1">Testar webhook manualmente:</p>
                  <code className="block bg-white p-2 rounded border">
                    SELECT manual_webhook_test('email@exemplo.com', 'https://webhook.site/sua-url');
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookDebugPanel;