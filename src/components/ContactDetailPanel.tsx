import React from 'react';
import { X, User, Mail, Phone, Building, Calendar, Tag as TagIcon, FileText, MapPin, Instagram, History } from 'lucide-react';
import { Contact, CRMData } from '../types';
import ContactActions from './ContactActions';
import LeadHistoryPanel from './LeadHistoryPanel';

interface ContactDetailPanelProps {
  contact: Contact;
  data: CRMData;
  isOpen: boolean;
  onClose: () => void;
}

const ContactDetailPanel: React.FC<ContactDetailPanelProps> = ({ contact, data, isOpen, onClose }) => {
  const [showHistory, setShowHistory] = React.useState(false);

  if (!isOpen) return null;

  const list = data.lists.find(l => l.id === contact.listId);
  const stage = data.pipelineStages.find(s => s.id === contact.stageId);
  const agent = data.agents.find(a => a.id === contact.assignedAgentId);

  const formatCustomFieldValue = (field: any, value: any) => {
    if (!value) return '-';
    
    switch (field.type) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(parseFloat(value) || 0);
      case 'date':
        return new Date(value).toLocaleDateString('pt-BR');
      case 'checkbox':
        return value ? 'Sim' : 'Não';
      default:
        return value;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
              <User className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{contact.name}</h2>
              <p className="text-sm text-gray-500">Detalhes do Contato</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Informações Básicas
            </h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-gray-400 mr-3" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-900">{contact.email}</p>
                </div>
              </div>
              
              {contact.phone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-xs text-gray-500">Telefone</p>
                    <p className="text-sm font-medium text-gray-900">{contact.phone}</p>
                  </div>
                </div>
              )}
              
              {contact.company && (
                <div className="flex items-center">
                  <Building className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-xs text-gray-500">Empresa</p>
                    <p className="text-sm font-medium text-gray-900">{contact.company}</p>
                  </div>
                </div>
              )}
              
              {contact.instagram && contact.instagram.trim() !== '' && (
                <div className="flex items-center">
                  <Instagram className="h-4 w-4 text-gray-400 mr-3" />
                  <div>
                    <p className="text-xs text-gray-500">Instagram</p>
                    <a 
                      href={`https://www.instagram.com/${contact.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {contact.instagram}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Status e Localização
            </h3>
            <div className="space-y-3">
              {list && (
                <div>
                  <p className="text-xs text-gray-500">Lista</p>
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: list.color + '20',
                      color: list.color
                    }}
                  >
                    {list.name}
                  </span>
                </div>
              )}
              
              {stage && (
                <div>
                  <p className="text-xs text-gray-500">Etapa</p>
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: stage.color + '20',
                      color: stage.color
                    }}
                  >
                    {stage.name}
                  </span>
                </div>
              )}
              
              {agent && (
                <div>
                  <p className="text-xs text-gray-500">Atendente</p>
                  <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                </div>
              )}
              
              {contact.source && (
                <div>
                  <p className="text-xs text-gray-500">Fonte</p>
                  <p className="text-sm font-medium text-gray-900">{contact.source}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <TagIcon className="h-4 w-4 mr-2" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map(tagId => {
                  const tag = data.tags.find(t => t.id === tagId);
                  return tag ? (
                    <span
                      key={tagId}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color
                      }}
                    >
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {data.customFields.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Campos Personalizados
              </h3>
              <div className="space-y-3">
                {data.customFields.map(field => {
                  const value = contact.customFields[field.id];
                  return (
                    <div key={field.id}>
                      <p className="text-xs text-gray-500">{field.name}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCustomFieldValue(field, value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Observações
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Datas
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Data de Criação</p>
                <p className="text-sm font-medium text-gray-900">
                  {contact.createdAt.toLocaleDateString('pt-BR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Última Atualização</p>
                <p className="text-sm font-medium text-gray-900">
                  {contact.updatedAt.toLocaleDateString('pt-BR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Ações Rápidas</h3>
            <div className="flex justify-center space-x-4">
              <ContactActions contact={contact} size="lg" className="space-x-4" />
              <button
                onClick={() => setShowHistory(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <History className="h-4 w-4 mr-2" />
                Ver Histórico
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Lead History Panel */}
      <LeadHistoryPanel
        contact={contact}
        data={data}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </>
  );
};

export default ContactDetailPanel;