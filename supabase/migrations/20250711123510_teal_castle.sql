/*
  # Sistema de Histórico de Leads

  1. Nova Tabela lead_master
    - Armazena permanentemente todos os leads únicos por email
    - Nunca é deletada, apenas marcada como inativa
    - Mantém histórico completo de mudanças

  2. Nova Tabela lead_history
    - Registra todas as mudanças nos leads
    - Histórico de listas, tags, atendentes, etapas
    - Timestamps de todas as alterações

  3. Triggers
    - Auto-criação/atualização na lead_master
    - Auto-registro de histórico em mudanças
    - Sincronização automática

  4. Índices
    - Otimização para consultas de histórico
    - Performance em buscas por email
*/

-- Criar tabela lead_master (histórico permanente)
CREATE TABLE IF NOT EXISTS lead_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  current_name text NOT NULL,
  first_phone text,
  current_phone text,
  first_company text,
  current_company text,
  first_source text,
  current_source text,
  is_active boolean DEFAULT true,
  total_interactions integer DEFAULT 1,
  first_created_at timestamptz NOT NULL,
  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela lead_history (histórico de mudanças)
CREATE TABLE IF NOT EXISTS lead_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_master_id uuid REFERENCES lead_master(id) ON DELETE CASCADE,
  contact_id uuid, -- Referência ao contato atual (pode ser null se deletado)
  action_type text NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted', 'list_changed', 'stage_changed', 'agent_changed', 'tags_changed')),
  field_name text,
  old_value text,
  new_value text,
  list_id uuid,
  list_name text,
  stage_id uuid,
  stage_name text,
  agent_id uuid,
  agent_name text,
  tags text[],
  tag_names text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_master_email ON lead_master(email);
CREATE INDEX IF NOT EXISTS idx_lead_master_is_active ON lead_master(is_active);
CREATE INDEX IF NOT EXISTS idx_lead_history_lead_master_id ON lead_history(lead_master_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_contact_id ON lead_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_action_type ON lead_history(action_type);
CREATE INDEX IF NOT EXISTS idx_lead_history_created_at ON lead_history(created_at);

-- Habilitar RLS
ALTER TABLE lead_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Allow all operations on lead_master" ON lead_master FOR ALL USING (true);
CREATE POLICY "Allow all operations on lead_history" ON lead_history FOR ALL USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_lead_master_updated_at 
  BEFORE UPDATE ON lead_master 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para sincronizar com lead_master
CREATE OR REPLACE FUNCTION sync_lead_master()
RETURNS TRIGGER AS $$
DECLARE
    master_record lead_master%ROWTYPE;
    list_record lists%ROWTYPE;
    stage_record pipeline_stages%ROWTYPE;
    agent_record agents%ROWTYPE;
    tag_names_array text[];
BEGIN
    -- Buscar dados relacionados
    IF NEW.list_id IS NOT NULL THEN
        SELECT * INTO list_record FROM lists WHERE id = NEW.list_id;
    END IF;
    
    IF NEW.stage_id IS NOT NULL THEN
        SELECT * INTO stage_record FROM pipeline_stages WHERE id = NEW.stage_id;
    END IF;
    
    IF NEW.assigned_agent_id IS NOT NULL THEN
        SELECT * INTO agent_record FROM agents WHERE id = NEW.assigned_agent_id;
    END IF;
    
    -- Buscar nomes das tags
    IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
        SELECT array_agg(name) INTO tag_names_array 
        FROM tags 
        WHERE id = ANY(NEW.tags::uuid[]);
    END IF;

    -- Verificar se já existe no lead_master
    SELECT * INTO master_record FROM lead_master WHERE email = NEW.email;
    
    IF master_record.id IS NULL THEN
        -- Criar novo registro no lead_master
        INSERT INTO lead_master (
            email, first_name, current_name, first_phone, current_phone,
            first_company, current_company, first_source, current_source,
            is_active, total_interactions, first_created_at, last_updated_at
        ) VALUES (
            NEW.email, NEW.name, NEW.name, NEW.phone, NEW.phone,
            NEW.company, NEW.company, NEW.source, NEW.source,
            true, 1, NEW.created_at, now()
        ) RETURNING * INTO master_record;
        
        -- Registrar criação no histórico
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, list_id, list_name,
            stage_id, stage_name, agent_id, agent_name, tags, tag_names,
            metadata
        ) VALUES (
            master_record.id, NEW.id, 'created', NEW.list_id, list_record.name,
            NEW.stage_id, stage_record.name, NEW.assigned_agent_id, agent_record.name,
            NEW.tags, tag_names_array,
            jsonb_build_object(
                'name', NEW.name,
                'phone', NEW.phone,
                'company', NEW.company,
                'source', NEW.source,
                'custom_fields', NEW.custom_fields
            )
        );
    ELSE
        -- Atualizar registro existente
        UPDATE lead_master SET
            current_name = NEW.name,
            current_phone = NEW.phone,
            current_company = NEW.company,
            current_source = NEW.source,
            is_active = true,
            total_interactions = total_interactions + 1,
            last_updated_at = now()
        WHERE id = master_record.id;
        
        -- Registrar atualização no histórico
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, list_id, list_name,
            stage_id, stage_name, agent_id, agent_name, tags, tag_names,
            metadata
        ) VALUES (
            master_record.id, NEW.id, 'updated', NEW.list_id, list_record.name,
            NEW.stage_id, stage_record.name, NEW.assigned_agent_id, agent_record.name,
            NEW.tags, tag_names_array,
            jsonb_build_object(
                'name', NEW.name,
                'phone', NEW.phone,
                'company', NEW.company,
                'source', NEW.source,
                'custom_fields', NEW.custom_fields
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para registrar mudanças específicas
CREATE OR REPLACE FUNCTION track_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
    master_record lead_master%ROWTYPE;
    list_record lists%ROWTYPE;
    stage_record pipeline_stages%ROWTYPE;
    agent_record agents%ROWTYPE;
    old_list_record lists%ROWTYPE;
    old_stage_record pipeline_stages%ROWTYPE;
    old_agent_record agents%ROWTYPE;
    tag_names_array text[];
    old_tag_names_array text[];
BEGIN
    -- Buscar lead_master
    SELECT * INTO master_record FROM lead_master WHERE email = NEW.email;
    
    IF master_record.id IS NULL THEN
        RETURN NEW; -- Não deveria acontecer, mas por segurança
    END IF;
    
    -- Buscar dados relacionados (novos)
    IF NEW.list_id IS NOT NULL THEN
        SELECT * INTO list_record FROM lists WHERE id = NEW.list_id;
    END IF;
    
    IF NEW.stage_id IS NOT NULL THEN
        SELECT * INTO stage_record FROM pipeline_stages WHERE id = NEW.stage_id;
    END IF;
    
    IF NEW.assigned_agent_id IS NOT NULL THEN
        SELECT * INTO agent_record FROM agents WHERE id = NEW.assigned_agent_id;
    END IF;
    
    -- Buscar dados relacionados (antigos)
    IF OLD.list_id IS NOT NULL THEN
        SELECT * INTO old_list_record FROM lists WHERE id = OLD.list_id;
    END IF;
    
    IF OLD.stage_id IS NOT NULL THEN
        SELECT * INTO old_stage_record FROM pipeline_stages WHERE id = OLD.stage_id;
    END IF;
    
    IF OLD.assigned_agent_id IS NOT NULL THEN
        SELECT * INTO old_agent_record FROM agents WHERE id = OLD.assigned_agent_id;
    END IF;
    
    -- Buscar nomes das tags
    IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
        SELECT array_agg(name) INTO tag_names_array 
        FROM tags 
        WHERE id = ANY(NEW.tags::uuid[]);
    END IF;
    
    IF OLD.tags IS NOT NULL AND array_length(OLD.tags, 1) > 0 THEN
        SELECT array_agg(name) INTO old_tag_names_array 
        FROM tags 
        WHERE id = ANY(OLD.tags::uuid[]);
    END IF;
    
    -- Verificar mudança de lista
    IF OLD.list_id IS DISTINCT FROM NEW.list_id THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            old_value, new_value, list_id, list_name
        ) VALUES (
            master_record.id, NEW.id, 'list_changed', 'list_id',
            old_list_record.name, list_record.name, NEW.list_id, list_record.name
        );
    END IF;
    
    -- Verificar mudança de etapa
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            old_value, new_value, stage_id, stage_name
        ) VALUES (
            master_record.id, NEW.id, 'stage_changed', 'stage_id',
            old_stage_record.name, stage_record.name, NEW.stage_id, stage_record.name
        );
    END IF;
    
    -- Verificar mudança de atendente
    IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            old_value, new_value, agent_id, agent_name
        ) VALUES (
            master_record.id, NEW.id, 'agent_changed', 'assigned_agent_id',
            old_agent_record.name, agent_record.name, NEW.assigned_agent_id, agent_record.name
        );
    END IF;
    
    -- Verificar mudança de tags
    IF OLD.tags IS DISTINCT FROM NEW.tags THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            old_value, new_value, tags, tag_names
        ) VALUES (
            master_record.id, NEW.id, 'tags_changed', 'tags',
            array_to_string(old_tag_names_array, ', '), array_to_string(tag_names_array, ', '),
            NEW.tags, tag_names_array
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar como inativo quando deletado
CREATE OR REPLACE FUNCTION mark_lead_master_inactive()
RETURNS TRIGGER AS $$
DECLARE
    master_record lead_master%ROWTYPE;
BEGIN
    -- Buscar lead_master
    SELECT * INTO master_record FROM lead_master WHERE email = OLD.email;
    
    IF master_record.id IS NOT NULL THEN
        -- Marcar como inativo
        UPDATE lead_master SET
            is_active = false,
            last_updated_at = now()
        WHERE id = master_record.id;
        
        -- Registrar deleção no histórico
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, metadata
        ) VALUES (
            master_record.id, OLD.id, 'deleted',
            jsonb_build_object(
                'deleted_at', now(),
                'name', OLD.name,
                'email', OLD.email
            )
        );
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers
DROP TRIGGER IF EXISTS sync_lead_master_on_insert ON contacts;
CREATE TRIGGER sync_lead_master_on_insert
    AFTER INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION sync_lead_master();

DROP TRIGGER IF EXISTS track_contact_changes_on_update ON contacts;
CREATE TRIGGER track_contact_changes_on_update
    AFTER UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION track_contact_changes();

DROP TRIGGER IF EXISTS mark_lead_master_inactive_on_delete ON contacts;
CREATE TRIGGER mark_lead_master_inactive_on_delete
    AFTER DELETE ON contacts
    FOR EACH ROW EXECUTE FUNCTION mark_lead_master_inactive();

-- Migrar dados existentes para lead_master
INSERT INTO lead_master (
    email, first_name, current_name, first_phone, current_phone,
    first_company, current_company, first_source, current_source,
    is_active, total_interactions, first_created_at, last_updated_at
)
SELECT DISTINCT ON (email)
    email, name, name, phone, phone,
    company, company, source, source,
    true, 1, created_at, updated_at
FROM contacts
WHERE email NOT IN (SELECT email FROM lead_master)
ORDER BY email, created_at;

-- Criar histórico inicial para contatos existentes
INSERT INTO lead_history (
    lead_master_id, contact_id, action_type, list_id, list_name,
    stage_id, stage_name, agent_id, agent_name, tags, tag_names,
    metadata, created_at
)
SELECT 
    lm.id,
    c.id,
    'created',
    c.list_id,
    l.name,
    c.stage_id,
    ps.name,
    c.assigned_agent_id,
    a.name,
    c.tags,
    (SELECT array_agg(t.name) FROM tags t WHERE t.id = ANY(c.tags::uuid[])),
    jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'company', c.company,
        'source', c.source,
        'custom_fields', c.custom_fields
    ),
    c.created_at
FROM contacts c
JOIN lead_master lm ON lm.email = c.email
LEFT JOIN lists l ON l.id = c.list_id
LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
LEFT JOIN agents a ON a.id = c.assigned_agent_id;