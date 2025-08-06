import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Folder, FolderOpen, List as ListIcon } from 'lucide-react';
import { CRMData } from '../types';
import { getCurrentUser } from '../lib/auth';
import { 
  getFolders, 
  getFolderLists, 
  createFolder, 
  updateFolder, 
  deleteFolder, 
  addListToFolder, 
  removeListFromFolder,
  type Folder as FolderType,
  type FolderList
} from '../lib/database';

interface FolderManagerProps {
  data: CRMData;
  onDataChange: () => void;
}

const FolderManager: React.FC<FolderManagerProps> = ({ data, onDataChange }) => {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [folderLists, setFolderLists] = useState<FolderList[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
  });

  React.useEffect(() => {
    loadFolderData();
  }, []);

  const loadFolderData = async () => {
    try {
      setLoading(true);
      const [foldersData, folderListsData] = await Promise.all([
        getFolders(),
        getFolderLists()
      ]);
      setFolders(foldersData);
      setFolderLists(folderListsData);
      
      // Auto-expand folders that have lists
      const foldersWithLists = foldersData
        .filter(folder => folderListsData.some(fl => fl.folderId === folder.id))
        .map(folder => folder.id);
      setExpandedFolders(new Set(foldersWithLists));
    } catch (error) {
      console.error('Error loading folder data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const user = getCurrentUser();
      if (!user) return;

      if (editingFolder) {
        await updateFolder(editingFolder.id, formData);
      } else {
        await createFolder({
          ...formData,
          userId: user.id
        });
      }
      
      await loadFolderData();
      resetForm();
    } catch (error) {
      console.error('Error saving folder:', error);
      alert('Erro ao salvar pasta');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#3B82F6',
    });
    setShowForm(false);
    setEditingFolder(null);
  };

  const handleEdit = (folder: FolderType) => {
    setEditingFolder(folder);
    setFormData({
      name: folder.name,
      color: folder.color,
    });
    setShowForm(true);
  };

  const handleDelete = async (folderId: string) => {
    if (confirm('Tem certeza que deseja excluir esta pasta? As listas serão movidas para fora da pasta.')) {
      try {
        await deleteFolder(folderId);
        await loadFolderData();
      } catch (error) {
        console.error('Error deleting folder:', error);
        alert('Erro ao excluir pasta');
      }
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const toggleListInFolder = async (folderId: string, listId: string) => {
    try {
      const isInFolder = folderLists.some(fl => fl.folderId === folderId && fl.listId === listId);
      
      if (isInFolder) {
        await removeListFromFolder(folderId, listId);
      } else {
        // Remove from other folders first
        const existingFolderList = folderLists.find(fl => fl.listId === listId);
        if (existingFolderList) {
          await removeListFromFolder(existingFolderList.folderId, listId);
        }
        await addListToFolder(folderId, listId);
      }
      
      await loadFolderData();
    } catch (error) {
      console.error('Error toggling list in folder:', error);
      alert('Erro ao mover lista');
    }
  };

  const getUnorganizedLists = () => {
    const organizedListIds = new Set(folderLists.map(fl => fl.listId));
    return data.lists.filter(list => !organizedListIds.has(list.id));
  };

  const getListsInFolder = (folderId: string) => {
    const listIds = folderLists.filter(fl => fl.folderId === folderId).map(fl => fl.listId);
    return data.lists.filter(list => listIds.includes(list.id));
  };
  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Organização em Pastas</h2>
            <p className="mt-1 text-sm text-gray-600">
              Organize suas listas em pastas para melhor visualização
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando pastas...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organização em Pastas</h2>
          <p className="mt-1 text-sm text-gray-600">
            Organize suas listas em pastas para melhor visualização
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Pasta
        </button>
      </div>

      {/* Folders */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          {folders.map(folder => {
            const isExpanded = expandedFolders.has(folder.id);
            const listsInFolder = getListsInFolder(folder.id);
            
            return (
              <div key={folder.id} className="border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-t-lg">
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="mr-3 text-gray-500 hover:text-gray-700"
                    >
                      {isExpanded ? (
                        <FolderOpen className="h-5 w-5" />
                      ) : (
                        <Folder className="h-5 w-5" />
                      )}
                    </button>
                    <div
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: folder.color }}
                    />
                    <h3 className="text-lg font-medium text-gray-900">
                      {folder.name}
                    </h3>
                    <span className="ml-2 text-sm text-gray-500">
                      ({listsInFolder.length} listas)
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(folder)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(folder.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="p-4 space-y-2">
                    {listsInFolder.length > 0 ? (
                      listsInFolder.map(list => (
                        <div key={list.id} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded">
                          <div className="flex items-center">
                            <ListIcon className="h-4 w-4 mr-2 text-gray-400" />
                            <div
                              className="w-2 h-2 rounded-full mr-2"
                              style={{ backgroundColor: list.color }}
                            />
                            <span className="text-sm font-medium text-gray-900">
                              {list.name}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleListInFolder(folder.id, list.id)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Remover
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">Nenhuma lista nesta pasta</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unorganized Lists */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Listas Não Organizadas ({getUnorganizedLists().length})
        </h3>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {getUnorganizedLists().map(list => (
            <div key={list.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-3"
                  style={{ backgroundColor: list.color }}
                />
                <span className="text-sm font-medium text-gray-900">
                  {list.name}
                </span>
              </div>
              
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    toggleListInFolder(e.target.value, list.id);
                    e.target.value = '';
                  }
                }}
                className="text-xs border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Adicionar à pasta...</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        
        {getUnorganizedLists().length === 0 && (
          <p className="text-sm text-gray-500 italic">Todas as listas estão organizadas em pastas</p>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" />
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {editingFolder ? 'Editar Pasta' : 'Nova Pasta'}
                </h3>
                <button
                  onClick={resetForm}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Pasta *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cor
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-gray-900' : 'border-gray-300'
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
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {editingFolder ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderManager;