import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';
import { List } from '../types';

interface ListIdDisplayProps {
  lists: List[];
}

const ListIdDisplay: React.FC<ListIdDisplayProps> = ({ lists }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showIds, setShowIds] = useState(false);

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">IDs das Listas</h3>
        <button
          onClick={() => setShowIds(!showIds)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {showIds ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          {showIds ? 'Ocultar' : 'Mostrar'} IDs
        </button>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Use estes IDs para enviar leads diretamente para listas específicas via webhook.
      </p>

      <div className="space-y-3">
        {lists.map((list) => (
          <div key={list.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-3"
                style={{ backgroundColor: list.color }}
              />
              <div>
                <div className="font-medium text-gray-900">{list.name}</div>
                <div className="text-sm text-gray-500">{list.description}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {showIds && (
                <code className="px-2 py-1 bg-gray-200 rounded text-xs font-mono text-gray-700">
                  {list.id}
                </code>
              )}
              <button
                onClick={() => copyToClipboard(list.id)}
                className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {copiedId === list.id ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar ID
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Como usar no webhook:</h4>
        <code className="text-xs text-blue-700 bg-blue-100 p-2 rounded block">
          {`{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "listId": "ID_DA_LISTA_AQUI"
}`}
        </code>
      </div>
    </div>
  );
};

export default ListIdDisplay;