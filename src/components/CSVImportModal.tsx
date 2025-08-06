import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { CRMData } from '../types';
import { createContact } from '../lib/database';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CRMData;
  onDataChange: () => void;
  onStartImport: (progress: ImportProgress) => void;
}

export interface ImportProgress {
  current: number;
  total: number;
  success: number;
  errors: string[];
  isComplete: boolean;
}

interface CSVColumn {
  index: number;
  name: string;
  sample: string;
}

interface FieldMapping {
  csvColumn: string;
  crmField: string;
}

const CSVImportModal: React.FC<CSVImportModalProps> = ({ 
  isOpen, 
  onClose, 
  data, 
  onDataChange, 
  onStartImport 
}) => {
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [selectedList, setSelectedList] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const crmFields = [
    { value: 'name', label: 'Nome *', required: true },
    { value: 'email', label: 'Email *', required: true },
    { value: 'phone', label: 'Telefone', required: false },
    { value: 'company', label: 'Empresa', required: false },
    { value: 'source', label: 'Fonte', required: false },
    { value: 'notes', label: 'Observações', required: false },
    { value: 'instagram', label: 'Instagram', required: false },
    ...data.customFields.map(field => ({
      value: `custom_${field.id}`,
      label: `${field.name} (Personalizado)`,
      required: field.required
    }))
  ];

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        
        if (parsed.length < 2) {
          alert('O arquivo CSV deve ter pelo menos uma linha de cabeçalho e uma linha de dados.');
          return;
        }

        setCsvData(parsed);
        
        const headers = parsed[0];
        const sampleRow = parsed[1] || [];
        
        const columns = headers.map((header, index) => ({
          index,
          name: header,
          sample: sampleRow[index] || ''
        }));
        
        setCsvColumns(columns);
        
        // Auto-map common fields
        const autoMappings: FieldMapping[] = [];
        columns.forEach(column => {
          const lowerName = column.name.toLowerCase();
          if (lowerName.includes('nome') || lowerName.includes('name')) {
            autoMappings.push({ csvColumn: column.name, crmField: 'name' });
          } else if (lowerName.includes('email') || lowerName.includes('e-mail')) {
            autoMappings.push({ csvColumn: column.name, crmField: 'email' });
          } else if (lowerName.includes('telefone') || lowerName.includes('phone') || lowerName.includes('celular')) {
            autoMappings.push({ csvColumn: column.name, crmField: 'phone' });
          } else if (lowerName.includes('empresa') || lowerName.includes('company')) {
            autoMappings.push({ csvColumn: column.name, crmField: 'company' });
          } else if (lowerName.includes('fonte') || lowerName.includes('source')) {
            autoMappings.push({ csvColumn: column.name, crmField: 'source' });
          } else if (lowerName.includes('instagram') || lowerName.includes('insta')) {
            autoMappings.push({ csvColumn: column.name, crmField: 'instagram' });
          } else if (lowerName.includes('observa') || lowerName.includes('notes') || lowerName.includes('nota')) {
            autoMappings.push({ csvColumn: column.name, crmField: 'notes' });
          }
        });
        
        setFieldMappings(autoMappings);
        setStep(2);
      } catch (error) {
        console.error('Erro ao processar CSV:', error);
        alert('Erro ao processar o arquivo CSV. Verifique se o formato está correto.');
      }
    };
    
    reader.onerror = () => {
      alert('Erro ao ler o arquivo. Tente novamente.');
    };
    
    reader.readAsText(file, 'UTF-8');
  };

  const handleMappingChange = (csvColumn: string, crmField: string) => {
    setFieldMappings(prev => {
      const filtered = prev.filter(m => m.csvColumn !== csvColumn);
      if (crmField) {
        return [...filtered, { csvColumn, crmField }];
      }
      return filtered;
    });
  };

  const getMappedField = (csvColumn: string) => {
    return fieldMappings.find(m => m.csvColumn === csvColumn)?.crmField || '';
  };

  const validateMappings = () => {
    const requiredFields = crmFields.filter(f => f.required).map(f => f.value);
    const mappedFields = fieldMappings.map(m => m.crmField);
    
    return requiredFields.every(field => mappedFields.includes(field));
  };

  const handleImport = async () => {
    if (!selectedList || !selectedStage) {
      alert('Selecione uma lista e uma etapa para importar os contatos.');
      return;
    }

    if (!validateMappings()) {
      alert('Mapeie todos os campos obrigatórios (Nome e Email) antes de continuar.');
      return;
    }

    console.log('🚀 Iniciando importação - total de contatos:', csvData.length - 1);
    setImporting(true);
    
    // Initialize progress
    const totalContacts = csvData.length - 1; // Exclude header
    const initialProgress: ImportProgress = {
      current: 0,
      total: totalContacts,
      success: 0,
      errors: [],
      isComplete: false
    };
    
    console.log('📤 Enviando progresso inicial:', initialProgress);
    // Notify parent component about import start
    onStartImport(initialProgress);
    
    // Close modal and start background import
    onClose();
    
    // Start the import process
    await performImport(totalContacts);
  };

  const performImport = async (totalContacts: number) => {
    console.log('⚡ Iniciando performImport com', totalContacts, 'contatos');
    const errors: string[] = [];
    let successCount = 0;
    let processedCount = 0;

    try {
      const dataRows = csvData.slice(1); // Skip header
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        processedCount = i + 1;
        
        console.log(`📝 Processando contato ${processedCount}/${totalContacts}`);
        
        try {
          const contactData: any = {
            listId: selectedList,
            stageId: selectedStage,
            tags: selectedTags,
            customFields: {}
          };

          // Map CSV columns to contact fields
          fieldMappings.forEach(mapping => {
            const columnIndex = csvColumns.find(col => col.name === mapping.csvColumn)?.index;
            if (columnIndex !== undefined && row[columnIndex] !== undefined) {
              const value = row[columnIndex]?.trim() || '';
              
              if (mapping.crmField.startsWith('custom_')) {
                const fieldId = mapping.crmField.replace('custom_', '');
                contactData.customFields[fieldId] = value;
              } else if (mapping.crmField === 'instagram') {
                // Clean Instagram handle
                let instagramValue = value;
                if (instagramValue && !instagramValue.startsWith('@')) {
                  instagramValue = instagramValue.replace(/^@/, '');
                }
                contactData.instagram = instagramValue;
              } else {
                contactData[mapping.crmField] = value;
              }
            }
          });

          // Validate required fields
          if (!contactData.name || !contactData.email) {
            errors.push(`Linha ${i + 2}: Nome e email são obrigatórios`);
            console.log(`❌ Erro linha ${i + 2}: campos obrigatórios`);
            continue;
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(contactData.email)) {
            errors.push(`Linha ${i + 2}: Email inválido (${contactData.email})`);
            console.log(`❌ Erro linha ${i + 2}: email inválido`);
            continue;
          }


          await createContact(contactData);
          successCount++;
          console.log(`✅ Contato ${processedCount} importado com sucesso`);
          
          // ✅ CORREÇÃO: Update progress SEMPRE sem marcar como completo
          const currentProgress: ImportProgress = {
            current: processedCount,
            total: totalContacts,
            success: successCount,
            errors: [...errors],
            isComplete: false
          };
          console.log(`📊 Atualizando progresso:`, currentProgress);
          onStartImport(currentProgress);
          
        } catch (error: any) {
          console.error(`❌ Erro ao importar linha ${i + 2}:`, error);
          const errorMessage = error.message || 'Erro desconhecido';
          errors.push(`Linha ${i + 2}: ${errorMessage}`);
          
          // ✅ CORREÇÃO: Update progress com erro SEMPRE sem marcar como completo
          const currentProgress: ImportProgress = {
            current: processedCount,
            total: totalContacts,
            success: successCount,
            errors: [...errors],
            isComplete: false
          };
          console.log(`📊 Atualizando progresso (com erro):`, currentProgress);
          onStartImport(currentProgress);
        }
        
        // Small delay to prevent UI blocking and rate limiting
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // ✅ CORREÇÃO: Final progress update - AGORA marca como completo
      const finalProgress: ImportProgress = {
        current: totalContacts,
        total: totalContacts,
        success: successCount,
        errors,
        isComplete: true // ✅ CORREÇÃO: Só agora marca como completo
      };
      console.log('🏁 Importação FINALIZADA - progresso final:', finalProgress);
      onStartImport(finalProgress);
      
      // ✅ CORREÇÃO: Atualiza dados APÓS marcar como completo - SEM RELOAD
      console.log('🔄 Atualizando dados após conclusão...');
      // ✅ CORREÇÃO: Não forçar reload - deixar o realtime handle
      // onDataChange(); // Removido para evitar reload
      
      console.log('✅ Importação concluída:', {
        total: totalContacts,
        success: successCount,
        errors: errors.length
      });

    } catch (error) {
      console.error('❌ Erro crítico durante a importação:', error);
      const criticalError = `Erro crítico: ${error.message || 'Erro interno'}`;
      
      // ✅ CORREÇÃO: Mesmo em erro crítico, marca como completo para permitir fechar
      const finalProgress: ImportProgress = {
        current: processedCount,
        total: totalContacts,
        success: successCount,
        errors: [...errors, criticalError],
        isComplete: true
      };
      console.log('💥 Erro crítico - progresso final:', finalProgress);
      onStartImport(finalProgress);
    } finally {
      setImporting(false);
      console.log('🔚 performImport finalizado');
    }
  };

  const resetModal = () => {
    setStep(1);
    setCsvData([]);
    setCsvColumns([]);
    setFieldMappings([]);
    setSelectedList('');
    setSelectedStage('');
    setSelectedTags([]);
    setTagSearch('');
    setImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!importing) {
      resetModal();
    }
    onClose();
  };

  const downloadTemplate = () => {
    const headers = ['nome', 'email', 'telefone', 'empresa', 'fonte', 'observacoes', 'instagram'];
    const sampleData = [
      'João Silva', 
      'joao@exemplo.com', 
      '(11) 99999-9999', 
      'Empresa XYZ', 
      'Website', 
      'Lead interessado em nossos serviços',
      '@joaosilva'
    ];
    
    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'template-importacao-contatos.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  if (!isOpen) return null;

  const filteredTags = data.tags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
        
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Importar Contatos via CSV
            </h3>
            <button
              onClick={handleClose}
              disabled={importing}
              className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    step >= stepNumber ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {stepNumber}
                  </div>
                  {stepNumber < 3 && (
                    <div className={`w-24 h-1 mx-2 ${
                      step > stepNumber ? 'bg-indigo-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Upload do Arquivo</span>
              <span>Mapeamento de Campos</span>
              <span>Configuração e Importação</span>
            </div>
          </div>

          {/* Step 1: File Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <h4 className="mt-2 text-lg font-medium text-gray-900">
                  Selecione o arquivo CSV
                </h4>
                <p className="mt-1 text-sm text-gray-500">
                  Faça upload do arquivo CSV com os contatos para importar
                </p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="text-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo CSV
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 mr-2" />
                  <div>
                    <h5 className="text-sm font-medium text-blue-800">Requisitos do arquivo CSV:</h5>
                    <ul className="mt-1 text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li>Use vírgula (,) como separador de campos</li>
                      <li>Primeira linha deve conter os cabeçalhos das colunas</li>
                      <li>Campos obrigatórios: Nome e Email</li>
                      <li>Codificação UTF-8 recomendada para caracteres especiais</li>
                      <li>Máximo de 1000 contatos por importação</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Template de Exemplo
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Mapear Colunas do CSV
                </h4>
                <p className="text-sm text-gray-500">
                  Associe cada coluna do CSV com os campos do CRM. Campos marcados com * são obrigatórios.
                </p>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {csvColumns.map((column) => (
                  <div key={column.index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{column.name}</div>
                      <div className="text-sm text-gray-500">
                        Exemplo: {column.sample ? `"${column.sample}"` : 'Vazio'}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <select
                        value={getMappedField(column.name)}
                        onChange={(e) => handleMappingChange(column.name, e.target.value)}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">Não mapear</option>
                        {crmFields.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {!validateMappings() && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                    <div>
                      <h5 className="text-sm font-medium text-red-800">
                        Campos obrigatórios não mapeados
                      </h5>
                      <p className="mt-1 text-sm text-red-700">
                        Você deve mapear pelo menos os campos Nome e Email para continuar.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Voltar
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!validateMappings()}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Configuration */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Configurar Importação
                </h4>
                <p className="text-sm text-gray-500">
                  Defina a lista, etapa e tags para os contatos importados
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lista de Destino *
                  </label>
                  <select
                    value={selectedList}
                    onChange={(e) => setSelectedList(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Selecione uma lista</option>
                    {data.lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Etapa Inicial *
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Selecione uma etapa</option>
                    {data.pipelineStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (opcional)
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="Buscar tags..."
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                      {filteredTags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {filteredTags.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                selectedTags.includes(tag.id)
                                  ? 'text-white'
                                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                              }`}
                              style={{
                                backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined
                              }}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Nenhuma tag encontrada</p>
                      )}
                    </div>
                    
                    {selectedTags.length > 0 && (
                      <div className="text-sm text-gray-600">
                        {selectedTags.length} tag(s) selecionada(s)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                  <div>
                    <h5 className="text-sm font-medium text-yellow-800">
                      Resumo da Importação
                    </h5>
                    <p className="mt-1 text-sm text-yellow-700">
                      {csvData.length - 1} contatos serão importados para a lista "{data.lists.find(l => l.id === selectedList)?.name}".
                      Contatos duplicados (mesmo email na mesma lista) serão atualizados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  disabled={importing}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedList || !selectedStage || importing}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Iniciando Importação...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Iniciar Importação
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImportModal;