import { supabase } from './supabase';
import { testSupabaseConnection } from './supabase';
import { isValidUUID, cleanUUID } from '../utils/validation';
import { Contact, List, Agent, PipelineStage, Tag, CustomField, CRMData } from '../types';
import { distributeContactToAgent } from '../utils/distribution';
import { getCurrentUser } from './auth';

// Lead History types
export interface LeadMaster {
  id: string;
  email: string;
  first_name: string;
  current_name: string;
  first_phone?: string;
  current_phone?: string;
  first_company?: string;
  current_company?: string;
  first_source?: string;
  current_source?: string;
  is_active: boolean;
  total_interactions: number;
  first_created_at: Date;
  last_updated_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Pipeline Configuration types
export interface PipelineConfig {
  id: string;
  listId: string;
  userId: string;
  visibleStages: string[];
  stageOrder: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadHistory {
  id: string;
  lead_master_id: string;
  contact_id?: string;
  action_type: 'created' | 'updated' | 'deleted' | 'list_changed' | 'stage_changed' | 'agent_changed' | 'tags_changed';
  field_name?: string;
  old_value?: string;
  new_value?: string;
  list_id?: string;
  list_name?: string;
  stage_id?: string;
  stage_name?: string;
  agent_id?: string;
  agent_name?: string;
  tags?: string[];
  tag_names?: string[];
  metadata?: Record<string, any>;
  created_at: Date;
}

// Pipeline Configuration functions
export const getPipelineConfig = async (listId: string): Promise<PipelineConfig | null> => {
  try {
    const user = getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('pipeline_configs')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching pipeline config:', error);
      throw error;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      listId: data.list_id,
      userId: data.user_id,
      visibleStages: data.visible_stages || [],
      stageOrder: data.stage_order || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  } catch (error) {
    console.error('Error fetching pipeline config:', error);
    return null;
  }
};

export const savePipelineConfig = async (
  listId: string, 
  visibleStages: string[], 
  stageOrder: string[]
): Promise<PipelineConfig> => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('pipeline_configs')
    .upsert({
      list_id: listId,
      user_id: user.id,
      visible_stages: visibleStages,
      stage_order: stageOrder
    }, {
      onConflict: 'list_id,user_id'
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    listId: data.list_id,
    userId: data.user_id,
    visibleStages: data.visible_stages || [],
    stageOrder: data.stage_order || [],
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at)
  };
};

// Auto-create missing fields in database
const ensureCustomFieldsExist = async (customFields: Record<string, any>) => {
  if (!customFields || Object.keys(customFields).length === 0) return;
  
  try {
    // Filter out any Instagram-related fields
    const filteredFields = Object.keys(customFields).reduce((acc, key) => {
      const value = customFields[key];
      // Skip if key contains 'instagram' or value looks like Instagram handle
      if (key.toLowerCase().includes('instagram') || 
          (typeof value === 'string' && value.startsWith('@'))) {
        console.log(`🚫 Bloqueando campo personalizado do Instagram: ${key}`);
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {} as Record<string, any>);
    
    if (Object.keys(filteredFields).length === 0) return;
    
    // Get existing custom fields
    const { data: existingFields } = await supabase
      .from('custom_fields')
      .select('id, name');
    
    const existingFieldIds = new Set(existingFields?.map(f => f.id) || []);
    
    // Check if any field IDs in customFields don't exist
    for (const fieldId of Object.keys(filteredFields)) {
      if (!existingFieldIds.has(fieldId)) {
        console.log(`Custom field ${fieldId} not found, skipping...`);
      }
    }
  } catch (error) {
    console.error('Error checking custom fields:', error);
  }
};

// Clean up Instagram custom fields
export const cleanupInstagramCustomFields = async (): Promise<void> => {
  try {
    console.log('🧹 Limpando campos personalizados do Instagram...');
    
    // Find Instagram custom fields
    const { data: instagramFields, error: fetchError } = await supabase
      .from('custom_fields')
      .select('id, name, type')
      .or('type.eq.instagram,name.ilike.%instagram%');
    
    if (fetchError) {
      console.error('Error fetching Instagram fields:', fetchError);
      return;
    }
    
    if (instagramFields && instagramFields.length > 0) {
      console.log(`Encontrados ${instagramFields.length} campos do Instagram para remover:`, instagramFields);
      
      // Delete Instagram custom fields
      const { error: deleteError } = await supabase
        .from('custom_fields')
        .delete()
        .or('type.eq.instagram,name.ilike.%instagram%');
      
      if (deleteError) {
        console.error('Error deleting Instagram fields:', deleteError);
      } else {
        console.log('✅ Campos personalizados do Instagram removidos com sucesso');
      }
    } else {
      console.log('✅ Nenhum campo personalizado do Instagram encontrado');
    }
  } catch (error) {
    console.error('Error cleaning up Instagram fields:', error);
  }
};
// Lead History functions
export const getLeadMaster = async (email: string): Promise<LeadMaster | null> => {
  try {
    const { data, error } = await supabase
      .from('lead_master')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    return {
      id: data.id,
      email: data.email,
      first_name: data.first_name,
      current_name: data.current_name,
      first_phone: data.first_phone,
      current_phone: data.current_phone,
      first_company: data.first_company,
      current_company: data.current_company,
      first_source: data.first_source,
      current_source: data.current_source,
      is_active: data.is_active,
      total_interactions: data.total_interactions,
      first_created_at: new Date(data.first_created_at),
      last_updated_at: new Date(data.last_updated_at),
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at)
    };
  } catch (error) {
    console.error('Error fetching lead master:', error);
    return null;
  }
};

export const getLeadHistory = async (email: string): Promise<LeadHistory[]> => {
  try {
    const { data, error } = await supabase
      .from('lead_history')
      .select(`
        *,
        lead_master!inner(email)
      `)
      .eq('lead_master.email', email)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      lead_master_id: record.lead_master_id,
      contact_id: record.contact_id,
      action_type: record.action_type,
      field_name: record.field_name,
      old_value: record.old_value,
      new_value: record.new_value,
      list_id: record.list_id,
      list_name: record.list_name,
      stage_id: record.stage_id,
      stage_name: record.stage_name,
      agent_id: record.agent_id,
      agent_name: record.agent_name,
      tags: record.tags,
      tag_names: record.tag_names,
      metadata: record.metadata,
      created_at: new Date(record.created_at)
    }));
  } catch (error) {
    console.error('Error fetching lead history:', error);
    return [];
  }
};

export const getAllLeadMasters = async (): Promise<LeadMaster[]> => {
  try {
    const { data, error } = await supabase
      .from('lead_master')
      .select('*')
      .order('last_updated_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      email: record.email,
      first_name: record.first_name,
      current_name: record.current_name,
      first_phone: record.first_phone,
      current_phone: record.current_phone,
      first_company: record.first_company,
      current_company: record.current_company,
      first_source: record.first_source,
      current_source: record.current_source,
      is_active: record.is_active,
      total_interactions: record.total_interactions,
      first_created_at: new Date(record.first_created_at),
      last_updated_at: new Date(record.last_updated_at),
      created_at: new Date(record.created_at),
      updated_at: new Date(record.updated_at)
    }));
  } catch (error) {
    console.error('Error fetching all lead masters:', error);
    return [];
  }
};

// Folder management
export interface Folder {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderList {
  id: string;
  folderId: string;
  listId: string;
  createdAt: Date;
}

export const getFolders = async (): Promise<Folder[]> => {
  try {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      name: record.name,
      color: record.color,
      userId: record.user_id,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at)
    }));
  } catch (error) {
    console.error('Error fetching folders:', error);
    return [];
  }
};

export const getFolderLists = async (): Promise<FolderList[]> => {
  try {
    const { data, error } = await supabase
      .from('folder_lists')
      .select('*');
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      folderId: record.folder_id,
      listId: record.list_id,
      createdAt: new Date(record.created_at)
    }));
  } catch (error) {
    console.error('Error fetching folder lists:', error);
    return [];
  }
};

export const createFolder = async (folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> => {
  const { data, error } = await supabase
    .from('folders')
    .insert({
      name: folder.name,
      color: folder.color,
      user_id: folder.userId
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    userId: data.user_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at)
  };
};

export const updateFolder = async (id: string, folder: Partial<Folder>): Promise<Folder> => {
  const updateData: any = {};
  
  if (folder.name !== undefined) updateData.name = folder.name;
  if (folder.color !== undefined) updateData.color = folder.color;

  const { data, error } = await supabase
    .from('folders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    userId: data.user_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at)
  };
};

export const deleteFolder = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const addListToFolder = async (folderId: string, listId: string): Promise<void> => {
  const { error } = await supabase
    .from('folder_lists')
    .insert({
      folder_id: folderId,
      list_id: listId
    });
  
  if (error) throw error;
};

export const removeListFromFolder = async (folderId: string, listId: string): Promise<void> => {
  const { error } = await supabase
    .from('folder_lists')
    .delete()
    .eq('folder_id', folderId)
    .eq('list_id', listId);
  
  if (error) throw error;
};

// Initialize database with auto-setup
export const initializeDatabase = async () => {
  try {
    console.log('🔧 Inicializando conexão com Supabase...');
    
    // Test connection using the new function
    await testSupabaseConnection();
    
    // Simple check - just verify one table exists
    const { error } = await supabase.from('agents').select('id').limit(1);
    if (error) {
      console.error(`❌ Erro ao verificar tabelas:`, error);
      throw new Error(`Erro ao acessar banco de dados. Verifique as migrações.`);
    }
    
    console.log('✅ Conexão com banco de dados verificada');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
    throw error;
  }
};

// Contacts
export const getContacts = async (): Promise<Contact[]> => {
  try {
    console.log('🔄 Carregando TODOS os contatos do Supabase...');
    
    // ✅ CORREÇÃO: Buscar todos os contatos com paginação automática
    let allContacts: any[] = [];
    let page = 0;
    const pageSize = 1000; // Tamanho da página
    let hasMore = true;
    
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      console.log(`📄 Buscando página ${page + 1} (registros ${from}-${to})...`);
      
      const { data, error, count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error(`❌ Erro na página ${page + 1}:`, error);
        throw error;
      }
      
      if (data && data.length > 0) {
        allContacts = [...allContacts, ...data];
        console.log(`✅ Página ${page + 1}: ${data.length} contatos carregados (total acumulado: ${allContacts.length})`);
        
        // Verificar se há mais páginas
        hasMore = data.length === pageSize;
        page++;
        
        // Log do total se disponível
        if (count !== null && page === 1) {
          console.log(`📊 Total de contatos no banco: ${count}`);
        }
      } else {
        hasMore = false;
      }
      
      // Limite de segurança para evitar loop infinito
      if (page > 50) {
        console.warn('⚠️ Limite de 50 páginas atingido, parando busca');
        break;
      }
    }
    
    console.log(`✅ TOTAL FINAL: ${allContacts.length} contatos carregados do Supabase`);
    
    return allContacts.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone || '',
      company: record.company || '',
      instagram: record.instagram || '',
      listId: record.list_id || '',
      stageId: record.stage_id || '',
      assignedAgentId: record.assigned_agent_id || '',
      tags: record.tags || [],
      customFields: record.custom_fields || {},
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      source: record.source || '',
      notes: record.notes || ''
    }));
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
};

export const createContact = async (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> => {
  console.log('🔄 Criando contato:', contact);
  
  // Validate required fields
  if (!contact.name || !contact.name.trim()) {
    throw new Error('Nome é obrigatório');
  }
  
  if (!contact.email || !contact.email.trim()) {
    throw new Error('Email é obrigatório');
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(contact.email)) {
    throw new Error('Formato de email inválido');
  }
  
  // Clean Instagram from custom fields if it exists there
  const cleanedCustomFields = { ...contact.customFields };
  Object.keys(cleanedCustomFields).forEach(key => {
    if (key.toLowerCase().includes('instagram')) {
      console.log(`🧹 Removendo Instagram dos campos personalizados: ${key}`);
      delete cleanedCustomFields[key];
    }
  });
  
  // Check for duplicates in the same list
  if (contact.listId) {
    const { data: existingContacts, error: searchError } = await supabase
      .from('contacts')
      .select('id, name, email, phone') 
      .eq('list_id', contact.listId)
      .eq('email', contact.email);
    
    if (searchError) {
      console.error('Error checking for duplicates:', searchError);
      // Continue with creation if search fails
    }
    
    if (existingContacts && existingContacts.length > 0) {
      // Update existing contact instead of creating duplicate
      const existingContact = existingContacts[0];
      console.log('📝 Atualizando contato existente:', existingContact.email);
      
      try {
        return await updateContact(existingContact.id, { 
          ...contact, 
          customFields: cleanedCustomFields 
        });
      } catch (updateError) {
        console.error('Error updating existing contact:', updateError);
        throw new Error(`Erro ao atualizar contato existente: ${updateError.message}`);
      }
    }
  }

  // Auto-assign agent if not specified
  let assignedAgentId = contact.assignedAgentId;
  
  if (!assignedAgentId && contact.listId) {
    const lists = await getLists();
    const agents = await getAgents();
    const contacts = await getContacts();
    
    const targetList = lists.find(l => l.id === contact.listId);
    if (targetList) {
      assignedAgentId = distributeContactToAgent(
        { ...contact, customFields: cleanedCustomFields } as Contact,
        agents,
        contacts,
        targetList
      );
    }
  }

  // Ensure custom fields exist
  await ensureCustomFieldsExist(cleanedCustomFields);

  // Prepare data for insertion
  const insertData = {
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    instagram: contact.instagram || '',
    list_id: cleanUUID(contact.listId),
    stage_id: cleanUUID(contact.stageId),
    assigned_agent_id: cleanUUID(assignedAgentId),
    tags: Array.isArray(contact.tags) ? contact.tags : [],
    custom_fields: cleanedCustomFields || {},
    source: contact.source || '',
    notes: contact.notes || ''
  };
  
  console.log('📤 Dados para inserção:', insertData);

  const { data, error } = await supabase
    .from('contacts')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ Erro ao inserir contato:', error);
    
    // Provide more specific error messages
    if (error.code === '23505') {
      throw new Error('Contato com este email já existe nesta lista');
    } else if (error.code === '23503') {
      throw new Error('Lista, etapa ou atendente especificado não existe');
    } else {
      throw new Error(`Erro ao criar contato: ${error.message}`);
    }
  }

  console.log('✅ Contato criado com sucesso:', data.id);

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    company: data.company || '',
    instagram: data.instagram || '',
    listId: data.list_id || '',
    stageId: data.stage_id || '',
    assignedAgentId: data.assigned_agent_id || '',
    tags: data.tags || [],
    customFields: data.custom_fields || {},
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    source: data.source || '',
    notes: data.notes || ''
  };
};

export const updateContact = async (id: string, contact: Partial<Contact>): Promise<Contact> => {
  console.log('💾 Salvando contato no banco de dados:', id, contact);
  
  // Clean Instagram from custom fields if it exists there
  let cleanedCustomFields = contact.customFields;
  if (cleanedCustomFields) {
    cleanedCustomFields = { ...cleanedCustomFields };
    Object.keys(cleanedCustomFields).forEach(key => {
      if (key.toLowerCase().includes('instagram')) {
        console.log(`🧹 Removendo Instagram dos campos personalizados: ${key}`);
        delete cleanedCustomFields[key];
      }
    });
  }
  
  const updateData: any = {};
  
  if (contact.name !== undefined) updateData.name = contact.name;
  if (contact.email !== undefined) updateData.email = contact.email;
  if (contact.phone !== undefined) updateData.phone = contact.phone;
  if (contact.company !== undefined) updateData.company = contact.company;
  if (contact.instagram !== undefined) updateData.instagram = contact.instagram;
  if (contact.listId !== undefined) updateData.list_id = cleanUUID(contact.listId);
  if (contact.stageId !== undefined) updateData.stage_id = cleanUUID(contact.stageId);
  if (contact.assignedAgentId !== undefined) updateData.assigned_agent_id = cleanUUID(contact.assignedAgentId);
  if (contact.tags !== undefined) updateData.tags = contact.tags;
  if (cleanedCustomFields !== undefined) {
    await ensureCustomFieldsExist(cleanedCustomFields);
    updateData.custom_fields = cleanedCustomFields;
  }
  if (contact.source !== undefined) updateData.source = contact.source;
  if (contact.notes !== undefined) updateData.notes = contact.notes;

  console.log('📤 Dados que serão salvos no Supabase:', updateData);

  const { data, error } = await supabase
    .from('contacts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ ERRO CRÍTICO ao salvar no banco:', error);
    throw error;
  }

  console.log('✅ SUCESSO: Contato salvo no banco:', data.id, 'Nova etapa:', data.stage_id);

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    company: data.company || '',
    instagram: data.instagram || '',
    listId: data.list_id || '',
    stageId: data.stage_id || '',
    assignedAgentId: data.assigned_agent_id || '',
    tags: data.tags || [],
    customFields: data.custom_fields || {},
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    source: data.source || '',
    notes: data.notes || ''
  };
};

export const deleteContact = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Bulk update contacts
export const updateContacts = async (contactIds: string[], updates: Partial<Contact>): Promise<void> => {
  const updateData: any = {};
  
  if (updates.listId !== undefined) updateData.list_id = cleanUUID(updates.listId);
  if (updates.stageId !== undefined) updateData.stage_id = cleanUUID(updates.stageId);
  if (updates.assignedAgentId !== undefined) updateData.assigned_agent_id = cleanUUID(updates.assignedAgentId);
  if (updates.tags !== undefined) updateData.tags = updates.tags;

  const { error } = await supabase
    .from('contacts')
    .update(updateData)
    .in('id', contactIds);

  if (error) throw error;
};

// Lists
export const getLists = async (): Promise<List[]> => {
  try {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      name: record.name,
      description: record.description || '',
      color: record.color,
      distributionRules: record.distribution_rules || []
    }));
  } catch (error) {
    console.error('Error fetching lists:', error);
    return [];
  }
};

export const createList = async (list: Omit<List, 'id'>): Promise<List> => {
  const { data, error } = await supabase
    .from('lists')
    .insert({
      name: list.name,
      description: list.description,
      color: list.color,
      distribution_rules: list.distributionRules
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    color: data.color,
    distributionRules: data.distribution_rules || []
  };
};

export const updateList = async (id: string, list: Partial<List>): Promise<List> => {
  const updateData: any = {};
  
  if (list.name !== undefined) updateData.name = list.name;
  if (list.description !== undefined) updateData.description = list.description;
  if (list.color !== undefined) updateData.color = list.color;
  if (list.distributionRules !== undefined) updateData.distribution_rules = list.distributionRules;

  const { data, error } = await supabase
    .from('lists')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    color: data.color,
    distributionRules: data.distribution_rules || []
  };
};

export const deleteList = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('lists')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Agents
export const getAgents = async (): Promise<Agent[]> => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      isActive: record.is_active,
      phone: record.phone || '',
      role: record.role || ''
    }));
  } catch (error) {
    console.error('Error fetching agents:', error);
    return [];
  }
};

export const createAgent = async (agent: Omit<Agent, 'id'>): Promise<Agent> => {
  const { data, error } = await supabase
    .from('agents')
    .insert({
      name: agent.name,
      email: agent.email,
      is_active: agent.isActive,
      phone: agent.phone,
      role: agent.role
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    isActive: data.is_active,
    phone: data.phone || '',
    role: data.role || ''
  };
};

export const updateAgent = async (id: string, agent: Partial<Agent>): Promise<Agent> => {
  const updateData: any = {};
  
  if (agent.name !== undefined) updateData.name = agent.name;
  if (agent.email !== undefined) updateData.email = agent.email;
  if (agent.isActive !== undefined) updateData.is_active = agent.isActive;
  if (agent.phone !== undefined) updateData.phone = agent.phone;
  if (agent.role !== undefined) updateData.role = agent.role;

  const { data, error } = await supabase
    .from('agents')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    isActive: data.is_active,
    phone: data.phone || '',
    role: data.role || ''
  };
};

export const deleteAgent = async (id: string): Promise<void> => {
  // Remove agent from all distribution rules first
  const lists = await getLists();
  for (const list of lists) {
    const updatedRules = list.distributionRules.filter(rule => rule.agentId !== id);
    if (updatedRules.length !== list.distributionRules.length) {
      await updateList(list.id, { distributionRules: updatedRules });
    }
  }
  
  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Pipeline Stages
export const getPipelineStages = async (): Promise<PipelineStage[]> => {
  try {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .order('order');
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      name: record.name,
      color: record.color,
      order: record.order,
      description: record.description || ''
    }));
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    return [];
  }
};

export const createPipelineStage = async (stage: Omit<PipelineStage, 'id'>): Promise<PipelineStage> => {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      name: stage.name,
      color: stage.color,
      order: stage.order,
      description: stage.description
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    order: data.order,
    description: data.description || ''
  };
};

export const updatePipelineStage = async (id: string, stage: Partial<PipelineStage>): Promise<PipelineStage> => {
  const updateData: any = {};
  
  if (stage.name !== undefined) updateData.name = stage.name;
  if (stage.color !== undefined) updateData.color = stage.color;
  if (stage.order !== undefined) updateData.order = stage.order;
  if (stage.description !== undefined) updateData.description = stage.description;

  const { data, error } = await supabase
    .from('pipeline_stages')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    order: data.order,
    description: data.description || ''
  };
};

export const deletePipelineStage = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Tags
export const getTags = async (): Promise<Tag[]> => {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      name: record.name,
      color: record.color,
      description: record.description || ''
    }));
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
};

export const createTag = async (tag: Omit<Tag, 'id'>): Promise<Tag> => {
  const { data, error } = await supabase
    .from('tags')
    .insert({
      name: tag.name,
      color: tag.color,
      description: tag.description
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    description: data.description || ''
  };
};

export const updateTag = async (id: string, tag: Partial<Tag>): Promise<Tag> => {
  const updateData: any = {};
  
  if (tag.name !== undefined) updateData.name = tag.name;
  if (tag.color !== undefined) updateData.color = tag.color;
  if (tag.description !== undefined) updateData.description = tag.description;

  const { data, error } = await supabase
    .from('tags')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    description: data.description || ''
  };
};

export const deleteTag = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Custom Fields
export const getCustomFields = async (): Promise<CustomField[]> => {
  try {
    const { data, error } = await supabase
      .from('custom_fields')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map(record => ({
      id: record.id,
      name: record.name,
      type: record.type as CustomField['type'],
      required: record.required,
      options: record.options || [],
      placeholder: record.placeholder || ''
    }));
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    return [];
  }
};

export const createCustomField = async (field: Omit<CustomField, 'id'>): Promise<CustomField> => {
  const { data, error } = await supabase
    .from('custom_fields')
    .insert({
      name: field.name,
      type: field.type,
      required: field.required,
      options: field.options,
      placeholder: field.placeholder
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    type: data.type as CustomField['type'],
    required: data.required,
    options: data.options || [],
    placeholder: data.placeholder || ''
  };
};

export const updateCustomField = async (id: string, field: Partial<CustomField>): Promise<CustomField> => {
  const updateData: any = {};
  
  if (field.name !== undefined) updateData.name = field.name;
  if (field.type !== undefined) updateData.type = field.type;
  if (field.required !== undefined) updateData.required = field.required;
  if (field.options !== undefined) updateData.options = field.options;
  if (field.placeholder !== undefined) updateData.placeholder = field.placeholder;

  const { data, error } = await supabase
    .from('custom_fields')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    type: data.type as CustomField['type'],
    required: data.required,
    options: data.options || [],
    placeholder: data.placeholder || ''
  };
};

export const deleteCustomField = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('custom_fields')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Load all data
export const loadAllData = async (): Promise<CRMData> => {
  try {
    const [contacts, lists, agents, pipelineStages, tags, customFields] = await Promise.all([
      getContacts(),
      getLists(),
      getAgents(),
      getPipelineStages(),
      getTags(),
      getCustomFields()
    ]);

    return {
      contacts,
      lists,
      agents,
      pipelineStages,
      tags,
      customFields
    };
  } catch (error) {
    console.error('Error loading all data:', error);
    return {
      contacts: [],
      lists: [],
      agents: [],
      pipelineStages: [],
      tags: [],
      customFields: []
    };
  }
};