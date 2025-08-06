import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, GripVertical, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { PipelineStage } from '../types';
import { createPipelineStage, updatePipelineStage, deletePipelineStage } from '../lib/database';
import { useToast } from '../hooks/useToast';

interface PipelineStageManagerProps {
  stages: PipelineStage[];
  isOpen: boolean;
  onClose: () => void;
  onDataChange: () => void;
}

interface StageFormData {
  name: string;
  color: string;
  description: string;
  order: number;
}

const PipelineStageManager: React.FC<PipelineStageManagerProps> = ({
  stages,
  isOpen,
  onClose,
  onDataChange
}) => {
  const toast = useToast();
  const [localStages, setLocalStages] = useState<PipelineStage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [draggedStage, setDraggedStage] = useState<PipelineStage | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState<StageFormData>({
    name: '',
    color: '#3B82F6',
    description: '',
    order: 0
  });

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
    '#06B6D4', '#F43F5E', '#8B5A2B', '#6B7280', '#1F2937'
  ];

  // Initialize local stages
  useEffect(() => {
    if (isOpen) {
      const sortedStages = [...stages].sort((a, b) => a.order - b.order);
      setLocalStages(sortedStages);
      setHasChanges(false);
    }
  }, [stages, isOpen]);

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#3B82F6',
      description: '',
      order: localStages.length
    });
    setShowForm(false);
    setEditingStage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }

    try {
      if (editingStage) {
        await updatePipelineStage(editingStage.id, formData);
        toast.success('Etapa atualizada com sucesso!');
      } else {
        await createPipelineStage(formData);
        toast.success('Etapa criada com sucesso!');
      }
      
      onDataChange();
      resetForm();
    } catch (error) {
      console.error('Error saving stage:', error);
      toast.error('Erro ao salvar etapa');
    }
  };

  const handleEdit = (stage: PipelineStage) => {
    setEditingStage(stage);
    setFormData({
      name: stage.name,
      color: stage.color,
      description: stage.description || '',
      order: stage.order
    });
    setShowForm(true);
  };

  const handleDelete = async (stage: PipelineStage) => {
    // Check if stage has contacts
    const stageHasContacts = false; // This would need to be checked against contacts
    
    if (stageHasContacts) {
      toast.error('Não é possível excluir uma etapa que possui contatos');
      return;
    }

    if (localStages.length <= 1) {
      toast.error('Deve haver pelo menos uma etapa no funil');
      return;
    }

    if (confirm(`Tem certeza que deseja excluir a etapa "${stage.name}"?`)) {
      try {
        await deletePipelineStage(stage.id);
        toast.success('Etapa excluída com sucesso!');
        onDataChange();
      } catch (error) {
        console.error('Error deleting stage:', error);
        toast.error('Erro ao excluir etapa');
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, stage: PipelineStage) => {
    setDraggedStage(stage);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    
    if (!draggedStage || draggedStage.id === targetStage.id) {
      setDraggedStage(null);
      return;
    }

    const newStages = [...localStages];
    const draggedIndex = newStages.findIndex(s => s.id === draggedStage.id);
    const targetIndex = newStages.findIndex(s => s.id === targetStage.id);

    // Remove dragged stage and insert at target position
    newStages.splice(draggedIndex, 1);
    newStages.splice(targetIndex, 0, draggedStage);

    // Update order values
    const updatedStages = newStages.map((stage, index) => ({
      ...stage,
      order: index
    }));

    setLocalStages(updatedStages);
    setHasChanges(true);
    setDraggedStage(null);
  };

  const handleDragEnd = () => {
    setDraggedStage(null);
  };

  const saveOrder = async () => {
    try {
      // Update all stages with new order
      for (const stage of localStages) {
        await updatePipelineStage(stage.id, { order: stage.order });
      }
      
      toast.success('Ordem das etapas atualizada!');
      setHasChanges(false);
      onDataChange();
    } catch (error) {
      console.error('Error updating stage order:', error);
      toast.error('Erro ao atualizar ordem das etapas');
    }
  };

  const resetOrder = () => {
    const sortedStages = [...stages].sort((a, b) => a.order - b.order);
    setLocalStages(sortedStages);
    setHasChanges(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
        
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Configurar Etapas do Funil
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Gerencie as etapas do seu funil de vendas
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {hasChanges && (
                <div className="flex items-center text-orange-600">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span className="text-sm">Ordem alterada</span>
                </div>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stages List */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900">
                  Etapas Atuais ({localStages.length})
                </h4>
                <div className="flex space-x-2">
                  {hasChanges && (
                    <>
                      <button
                        onClick={resetOrder}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Resetar
                      </button>
                      <button
                        onClick={saveOrder}
                        className="inline-flex items-center px-2 py-1 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Salvar Ordem
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Etapa
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {localStages.map((stage, index) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, stage)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border-2 transition-all cursor-move ${
                      draggedStage?.id === stage.id 
                        ? 'border-indigo-400 bg-indigo-50 opacity-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 font-mono w-6">
                          {index + 1}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <div>
                          <div className="font-medium text-gray-900">{stage.name}</div>
                          {stage.description && (
                            <div className="text-sm text-gray-500">{stage.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(stage)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Editar etapa"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(stage)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir etapa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Dica:</strong> Arraste e solte as etapas para reorganizar a ordem do funil.
                  A primeira etapa será onde novos contatos são adicionados por padrão.
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-1">
              {showForm ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">
                    {editingStage ? 'Editar Etapa' : 'Nova Etapa'}
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Etapa *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Ex: Novo Lead, Proposta Enviada..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Descreva o que representa esta etapa..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cor
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {colorOptions.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            formData.color === color 
                              ? 'border-gray-900 scale-110' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      {editingStage ? 'Salvar' : 'Criar'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <Plus className="h-12 w-12 mx-auto" />
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Clique em "Nova Etapa" para adicionar uma nova etapa ao funil
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Etapa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineStageManager;