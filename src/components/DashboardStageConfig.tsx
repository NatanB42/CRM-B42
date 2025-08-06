import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, CheckCircle, AlertCircle, X } from 'lucide-react';
import { PipelineStage } from '../types';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface DashboardStageConfigProps {
  stages: PipelineStage[];
  onConfigChange: (config: StageConfiguration) => void;
}

export interface StageConfiguration {
  totalCountStages: string[];
  conversionStages: string[];
}

const DashboardStageConfig: React.FC<DashboardStageConfigProps> = ({ 
  stages, 
  onConfigChange 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<StageConfiguration>({
    totalCountStages: [],
    conversionStages: []
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // ✅ CORREÇÃO: Carregar configuração do Supabase
  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      const user = getCurrentUser();
      if (!user) {
        console.log('❌ Usuário não encontrado');
        return;
      }

      console.log('🔄 Carregando configuração do dashboard para usuário:', user.id);

      const { data: dashboardConfig, error } = await supabase
        .from('dashboard_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Erro ao carregar configuração:', error);
        throw error;
      }

      let validatedConfig: StageConfiguration;

      if (dashboardConfig) {
        console.log('✅ Configuração encontrada:', dashboardConfig);
        
        // Validar que os stage IDs ainda existem
        const validTotalStages = (dashboardConfig.included_stages_for_total || []).filter((id: string) => 
          stages.some(stage => stage.id === id)
        );
        
        const validConversionStages = (dashboardConfig.included_stages_for_conversion || []).filter((id: string) => 
          stages.some(stage => stage.id === id)
        );

        validatedConfig = {
          totalCountStages: validTotalStages.length > 0 ? validTotalStages : stages.map(s => s.id),
          conversionStages: validConversionStages
        };
      } else {
        console.log('📝 Criando configuração padrão');
        // Configuração padrão - incluir todas as etapas no total
        validatedConfig = {
          totalCountStages: stages.map(s => s.id),
          conversionStages: []
        };

        // Salvar configuração padrão
        await saveConfigurationToDatabase(validatedConfig, user.id);
      }

      setConfig(validatedConfig);
      onConfigChange(validatedConfig);
      console.log('✅ Configuração carregada:', validatedConfig);
    } catch (error) {
      console.error('❌ Erro ao carregar configuração:', error);
      // Fallback para configuração padrão
      const defaultConfig = {
        totalCountStages: stages.map(s => s.id),
        conversionStages: []
      };
      setConfig(defaultConfig);
      onConfigChange(defaultConfig);
      toast.error('Erro ao carregar configurações, usando padrão');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ CORREÇÃO: Salvar configuração no Supabase
  const saveConfigurationToDatabase = async (configToSave: StageConfiguration, userId: string) => {
    console.log('💾 Salvando configuração no banco:', configToSave);

    const { data, error } = await supabase
      .from('dashboard_configs')
      .upsert({
        user_id: userId,
        included_stages_for_total: configToSave.totalCountStages,
        included_stages_for_conversion: configToSave.conversionStages
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar configuração:', error);
      throw error;
    }

    console.log('✅ Configuração salva no banco:', data);
    return data;
  };

  // Carregar configuração quando o componente monta ou stages mudam
  useEffect(() => {
    if (stages.length > 0) {
      loadConfiguration();
    }
  }, [stages]);

  // ✅ CORREÇÃO: Toggle de etapas com estado reativo
  const handleStageToggle = (stageId: string, type: 'total' | 'conversion') => {
    console.log('🔄 Toggling stage:', stageId, type);
    
    setConfig(prev => {
      const newConfig = { ...prev };
      
      if (type === 'total') {
        if (prev.totalCountStages.includes(stageId)) {
          newConfig.totalCountStages = prev.totalCountStages.filter(id => id !== stageId);
        } else {
          newConfig.totalCountStages = [...prev.totalCountStages, stageId];
        }
      } else {
        if (prev.conversionStages.includes(stageId)) {
          newConfig.conversionStages = prev.conversionStages.filter(id => id !== stageId);
        } else {
          newConfig.conversionStages = [...prev.conversionStages, stageId];
        }
      }
      
      console.log('📊 Nova configuração:', newConfig);
      setHasUnsavedChanges(true);
      return newConfig;
    });
  };

  // ✅ CORREÇÃO: Salvar com feedback melhorado
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const user = getCurrentUser();
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      console.log('💾 Salvando configuração:', config);

      // Salvar no banco de dados
      await saveConfigurationToDatabase(config, user.id);
      
      // Aplicar configuração imediatamente
      onConfigChange(config);
      
      setHasUnsavedChanges(false);
      toast.success('Configurações salvas com sucesso!');
      
      // Auto-fechar após sucesso
      setTimeout(() => {
        setIsOpen(false);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ CORREÇÃO: Reset para configuração padrão
  const handleReset = () => {
    const defaultConfig = {
      totalCountStages: stages.map(s => s.id),
      conversionStages: []
    };
    
    setConfig(defaultConfig);
    setHasUnsavedChanges(true);
    toast.info('Configurações resetadas para o padrão');
  };

  // ✅ CORREÇÃO: Cancelar mudanças
  const handleCancel = () => {
    // Recarregar configuração do banco
    loadConfiguration();
    setHasUnsavedChanges(false);
    setIsOpen(false);
  };

  const getStageName = (stageId: string) => {
    return stages.find(s => s.id === stageId)?.name || 'Etapa Desconhecida';
  };

  if (isLoading) {
    return (
      <button
        disabled
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white opacity-50 cursor-not-allowed"
      >
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
        Carregando...
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 relative"
      >
        <Settings className="h-4 w-4 mr-2" />
        Configurar Etapas
        {hasUnsavedChanges && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCancel} />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Configurar Etapas do Dashboard
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Selecione quais etapas devem ser incluídas nos cálculos do dashboard
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {hasUnsavedChanges && (
                    <div className="flex items-center text-orange-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span className="text-sm">Não salvo</span>
                    </div>
                  )}
                  <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Total Count Stages */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Etapas incluídas no total de contatos
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Selecione quais etapas devem ser contabilizadas no total de contatos do dashboard
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {stages.map(stage => (
                      <label 
                        key={`total-${stage.id}`} 
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={config.totalCountStages.includes(stage.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStageToggle(stage.id, 'total');
                          }}
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
                  <div className="mt-2 text-xs text-gray-500">
                    {config.totalCountStages.length} de {stages.length} etapas selecionadas
                  </div>
                </div>

                {/* Conversion Stages */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Etapas para cálculo da taxa de conversão
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Selecione quais etapas representam conversões bem-sucedidas
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {stages.map(stage => (
                      <label 
                        key={`conversion-${stage.id}`} 
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={config.conversionStages.includes(stage.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStageToggle(stage.id, 'conversion');
                          }}
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
                  <div className="mt-2 text-xs text-gray-500">
                    {config.conversionStages.length} de {stages.length} etapas selecionadas para conversão
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Preview da Configuração</h5>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Total de contatos: </span>
                      <span className="text-blue-600">
                        {config.totalCountStages.map(getStageName).join(', ') || 'Nenhuma etapa selecionada'}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Taxa de conversão: </span>
                      <span className="text-blue-600">
                        {config.conversionStages.map(getStageName).join(', ') || 'Nenhuma etapa selecionada'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar
                </button>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || isSaving}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Configurações
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardStageConfig;