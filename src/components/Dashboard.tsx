import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Target, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { CRMData, Contact } from '../types';
import DashboardStageConfig, { StageConfiguration } from './DashboardStageConfig';

interface DashboardProps {
  data: CRMData;
  onDataChange: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, onDataChange }) => {
  // ✅ CORREÇÃO: Estado inicial melhorado
  const [stageConfig, setStageConfig] = useState<StageConfiguration>({
    totalCountStages: [],
    conversionStages: []
  });
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // ✅ CORREÇÃO: Handler otimizado para mudanças de configuração
  const handleStageConfigChange = useCallback((newConfig: StageConfiguration) => {
    console.log('🔄 Atualizando configuração das etapas:', newConfig);
    setStageConfig(newConfig);
    setIsConfigLoaded(true);
  }, []);

  // ✅ CORREÇÃO: Configuração padrão quando não há configuração carregada
  useEffect(() => {
    if (!isConfigLoaded && data.pipelineStages.length > 0) {
      const defaultConfig = {
        totalCountStages: data.pipelineStages.map(s => s.id),
        conversionStages: []
      };
      setStageConfig(defaultConfig);
      console.log('📊 Usando configuração padrão:', defaultConfig);
    }
  }, [data.pipelineStages, isConfigLoaded]);
  
  // ✅ CORREÇÃO: Cálculos otimizados com fallback
  const totalContacts = stageConfig.totalCountStages.length > 0 
    ? data.contacts.filter(contact => stageConfig.totalCountStages.includes(contact.stageId)).length
    : data.contacts.length;
  
  const activeAgents = data.agents.filter(agent => agent.isActive).length;
  const totalLists = data.lists.length;
  
  // Calculate contacts by stage
  const contactsByStage = data.pipelineStages.map(stage => ({
    stage,
    count: data.contacts.filter(contact => contact.stageId === stage.id).length
  }));

  // Recent contacts (last 7 days)
  const recentContacts = data.contacts.filter(contact => {
    // ✅ CORREÇÃO: Verificar se há configuração antes de filtrar
    if (stageConfig.totalCountStages.length > 0 && !stageConfig.totalCountStages.includes(contact.stageId)) {
      return false;
    }
    const createdDate = new Date(contact.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdDate >= weekAgo;
  }).length;

  // ✅ CORREÇÃO: Taxa de conversão com fallback
  const convertedContacts = stageConfig.conversionStages.length > 0
    ? data.contacts.filter(contact => stageConfig.conversionStages.includes(contact.stageId)).length
    : 0;
  
  const allConfiguredContacts = stageConfig.totalCountStages.length > 0
    ? data.contacts.filter(contact => 
        stageConfig.totalCountStages.includes(contact.stageId) || 
        stageConfig.conversionStages.includes(contact.stageId)
      ).length
    : data.contacts.length;
  
  const conversionRate = allConfiguredContacts > 0 ? Math.round((convertedContacts / allConfiguredContacts) * 100) : 0;

  const stats = [
    {
      name: 'Total de Contatos',
      value: totalContacts.toLocaleString('pt-BR'),
      icon: Users,
      color: 'bg-blue-500',
      change: `+${recentContacts.toLocaleString('pt-BR')} esta semana`
    },
    {
      name: 'Atendentes Ativos',
      value: activeAgents.toLocaleString('pt-BR'),
      icon: UserPlus,
      color: 'bg-green-500',
      change: `${data.agents.length.toLocaleString('pt-BR')} total`
    },
    {
      name: 'Listas Ativas',
      value: totalLists.toLocaleString('pt-BR'),
      icon: Target,
      color: 'bg-purple-500',
      change: 'Organizadas'
    },
    {
      name: 'Taxa de Conversão',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      change: `${convertedContacts.toLocaleString('pt-BR')} convertidos`
    }
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard Configuration */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <DashboardStageConfig 
          stages={data.pipelineStages}
          onConfigChange={handleStageConfigChange}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`${stat.color} p-3 rounded-md`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-gray-500">
                    {stat.change}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Overview */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Visão Geral do Funil
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {contactsByStage.map((item) => (
              <div key={item.stage.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {item.stage.name}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {item.count}
                    </p>
                  </div>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.stage.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Atividade Recente
          </h3>
          <div className="flow-root">
            <ul className="-mb-8">
              {data.contacts
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5)
                .map((contact, index) => {
                  const list = data.lists.find(l => l.id === contact.listId);
                  const agent = data.agents.find(a => a.id === contact.assignedAgentId);
                  const stage = data.pipelineStages.find(s => s.id === contact.stageId);
                  
                  return (
                    <li key={contact.id}>
                      <div className="relative pb-8">
                        {index < 4 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="bg-blue-500 h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white">
                              <UserPlus className="h-4 w-4 text-white" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Novo contato <span className="font-medium text-gray-900">{contact.name}</span>
                                {list && (
                                  <span className="text-gray-500"> adicionado à lista <span className="font-medium">{list.name}</span></span>
                                )}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                {agent && (
                                  <span className="text-xs text-gray-500">
                                    Atendente: {agent.name}
                                  </span>
                                )}
                                {stage && (
                                  <span className="text-xs text-gray-500">
                                    Etapa: {stage.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;