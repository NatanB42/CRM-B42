import React, { useState } from 'react';
import { useToast } from '../hooks/useToast';
import { X, CheckCircle, AlertCircle, Upload, Download, Eye, EyeOff } from 'lucide-react';

// CORREÇÃO 5: Interface melhorada para controle de estado
interface ImportProgressIndicatorProps {
  isImporting: boolean;
  progress: {
    current: number;
    total: number;
    success: number;
    errors: string[];
    isComplete: boolean;
  };
  onCancel: () => void;
  onClose: () => void;
}

const ImportProgressIndicator: React.FC<ImportProgressIndicatorProps> = ({
  isImporting,
  progress,
  onCancel,
  onClose
}) => {
  const toast = useToast();
  const [showErrors, setShowErrors] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPersistent, setIsPersistent] = useState(true); // CORREÇÃO 5: Estado de persistência

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const hasErrors = progress.errors.length > 0;
  const isComplete = progress.isComplete;

  // CORREÇÃO 5: Lógica melhorada para exibição persistente
  // ✅ Mostrar toast quando importação completa
  React.useEffect(() => {
    if (isComplete && progress.success > 0) {
      toast.success(
        `Importação concluída! ${progress.success} contatos importados${progress.errors.length > 0 ? ` (${progress.errors.length} erros)` : ''}`,
        6000
      );
    }
  }, [isComplete, progress.success, progress.errors.length, toast]);

  const shouldShow = isPersistent && (isImporting || isComplete || progress.current > 0 || progress.total > 0);
  
  console.log('🎯 ImportProgressIndicator render check:', {
    shouldShow,
    isImporting,
    isComplete,
    current: progress.current,
    total: progress.total,
    isMinimized,
    isPersistent
  });
  
  if (!shouldShow) return null;

  const downloadErrorReport = () => {
    if (progress.errors.length === 0) return;

    const errorReport = [
      'Relatório de Erros - Importação CSV',
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      `Total de contatos processados: ${progress.current}`,
      `Sucessos: ${progress.success}`,
      `Erros: ${progress.errors.length}`,
      '',
      'Detalhes dos Erros:',
      ...progress.errors.map((error, index) => `${index + 1}. ${error}`)
    ].join('\n');

    const blob = new Blob([errorReport], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `erros-importacao-${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CORREÇÃO 5: Função para fechar definitivamente
  const handleDefinitiveClose = () => {
    setIsPersistent(false);
    onClose();
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 cursor-pointer hover:shadow-xl transition-shadow"
           onClick={() => setIsMinimized(false)}>
        <div className="flex items-center space-x-2">
          {isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <Upload className="h-5 w-5 text-blue-500 animate-pulse" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {isComplete ? 'Importação Concluída' : 'Importando...'}
          </span>
          <span className="text-xs text-gray-500">
            {progress.current}/{progress.total}
          </span>
          {hasErrors && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {progress.errors.length} erros
            </span>
          )}
          {/* CORREÇÃO 5: Botão de fechar no modo minimizado */}
          {isComplete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDefinitiveClose();
              }}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-w-md w-full animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          {isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          ) : (
            <Upload className="h-5 w-5 text-blue-500 mr-2 animate-pulse" />
          )}
          <h3 className="text-sm font-medium text-gray-900">
            {isComplete ? 'Importação Concluída' : 'Importando Contatos'}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {/* CORREÇÃO 5: Sempre permitir minimizar */}
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-gray-600"
            title="Minimizar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          {/* CORREÇÃO 5: Permitir fechar quando completo */}
          {isComplete && (
            <button
              onClick={handleDefinitiveClose}
              className="text-gray-400 hover:text-gray-600"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Progresso: {progress.current} de {progress.total}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isComplete 
                  ? hasErrors 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              <span className="text-green-700 font-medium">Sucessos</span>
            </div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {progress.success}
            </div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              <span className="text-red-700 font-medium">Erros</span>
            </div>
            <div className="text-2xl font-bold text-red-900 mt-1">
              {progress.errors.length}
            </div>
          </div>
        </div>

        {/* Status Messages */}
        <div className="space-y-2">
          {progress.success > 0 && (
            <div className="flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              {progress.success} contatos importados com sucesso
            </div>
          )}
          
          {hasErrors && (
            <div className="flex items-center text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mr-2" />
              {progress.errors.length} erro(s) encontrado(s)
            </div>
          )}

          {/* CORREÇÃO 5: Status melhorado com indicadores visuais */}
          {!isComplete && (isImporting || progress.current < progress.total) && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>Importação em andamento...</strong> Não recarregue a página até a conclusão.
              </p>
              <div className="mt-2 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-xs text-blue-600">
                  Processando contato {progress.current} de {progress.total}
                </span>
              </div>
              <div className="mt-2 text-xs text-blue-600">
                ⚠️ A página está protegida contra recarregamento
              </div>
              <div className="mt-2">
                <div className="w-full bg-blue-200 rounded-full h-1">
                  <div
                    className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {isComplete && (
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-sm text-green-700">
                <strong>Importação finalizada!</strong> Os contatos foram adicionados à lista.
                {hasErrors && ' Verifique os erros abaixo para mais detalhes.'}
              </p>
              <div className="mt-2 text-xs text-green-600">
                ✅ Você pode fechar esta janela ou navegar livremente
              </div>
            </div>
          )}
        </div>

        {/* Error Details */}
        {hasErrors && isComplete && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">
                Detalhes dos Erros ({progress.errors.length})
              </h4>
              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadErrorReport}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Baixar
                </button>
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {showErrors ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Ver
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {showErrors && (
              <div className="max-h-32 overflow-y-auto bg-red-50 rounded-lg p-3">
                <ul className="text-xs text-red-700 space-y-1">
                  {progress.errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="break-words">
                      <span className="font-medium">#{index + 1}:</span> {error}
                    </li>
                  ))}
                  {progress.errors.length > 10 && (
                    <li className="text-red-500 font-medium">
                      ... e mais {progress.errors.length - 10} erros (baixe o relatório completo)
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* CORREÇÃO 5: Botões de ação melhorados */}
        {isComplete && (
          <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
            <button
              onClick={() => setIsMinimized(true)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Minimizar
            </button>
            <button
              onClick={handleDefinitiveClose}
              className="px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportProgressIndicator;