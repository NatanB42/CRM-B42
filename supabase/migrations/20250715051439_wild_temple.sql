/*
  # Schema completo do CRM - Correção e padronização

  1. Tabelas principais
    - `users` - Usuários do sistema
    - `agents` - Atendentes
    - `lists` - Listas de contatos
    - `pipeline_stages` - Etapas do funil
    - `tags` - Tags para organização
    - `custom_fields` - Campos personalizados
    - `contacts` - Contatos principais
    - `folders` - Pastas para organização
    - `folder_lists` - Relacionamento pasta-lista
    - `dashboard_configs` - Configurações do dashboard
    - `lead_master` - Histórico consolidado de leads
    - `lead_history` - Histórico detalhado de mudanças

  2. Funções e triggers
    - Atualização automática de timestamps
    - Sincronização de lead master
    - Rastreamento de mudanças
    - Limpeza de campos Instagram

  3. Segurança
    - RLS habilitado onde necessário
    - Políticas de acesso adequadas
*/

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para prevenir campos personalizados do Instagram
CREATE OR REPLACE FUNCTION prevent_instagram_custom_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name ILIKE '%instagram%' OR NEW.type = 'instagram' THEN
        RAISE EXCEPTION 'Campos personalizados do Instagram não são permitidos. Use o campo nativo do Instagram.';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para limpar Instagram dos campos personalizados
CREATE OR REPLACE FUNCTION clean_instagram_from_custom_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Remove qualquer campo Instagram dos custom_fields
    IF NEW.custom_fields IS NOT NULL THEN
        NEW.custom_fields := (
            SELECT jsonb_object_agg(key, value)
            FROM jsonb_each(NEW.custom_fields)
            WHERE key NOT ILIKE '%instagram%'
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para sincronizar lead master
CREATE OR REPLACE FUNCTION sync_lead_master()
RETURNS TRIGGER AS $$
DECLARE
    master_record RECORD;
BEGIN
    -- Busca ou cria registro no lead_master
    SELECT * INTO master_record FROM lead_master WHERE email = NEW.email;
    
    IF master_record IS NULL THEN
        -- Cria novo registro
        INSERT INTO lead_master (
            email, first_name, current_name, first_phone, current_phone,
            first_company, current_company, first_source, current_source,
            is_active, total_interactions, first_created_at, last_updated_at
        ) VALUES (
            NEW.email, NEW.name, NEW.name, NEW.phone, NEW.phone,
            NEW.company, NEW.company, NEW.source, NEW.source,
            true, 1, NEW.created_at, NEW.updated_at
        );
    ELSE
        -- Atualiza registro existente
        UPDATE lead_master SET
            current_name = NEW.name,
            current_phone = NEW.phone,
            current_company = NEW.company,
            current_source = NEW.source,
            total_interactions = total_interactions + 1,
            last_updated_at = NEW.updated_at,
            is_active = true
        WHERE email = NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para marcar lead master como inativo
CREATE OR REPLACE FUNCTION mark_lead_master_inactive()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE lead_master SET
        is_active = false,
        last_updated_at = now()
    WHERE email = OLD.email;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Função para rastrear mudanças nos contatos
CREATE OR REPLACE FUNCTION track_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
    master_id UUID;
    list_name TEXT;
    stage_name TEXT;
    agent_name TEXT;
    old_list_name TEXT;
    old_stage_name TEXT;
    old_agent_name TEXT;
BEGIN
    -- Busca o ID do lead master
    SELECT id INTO master_id FROM lead_master WHERE email = NEW.email;
    
    -- Busca nomes para os novos valores
    SELECT name INTO list_name FROM lists WHERE id = NEW.list_id;
    SELECT name INTO stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
    SELECT name INTO agent_name FROM agents WHERE id = NEW.assigned_agent_id;
    
    -- Busca nomes para os valores antigos
    SELECT name INTO old_list_name FROM lists WHERE id = OLD.list_id;
    SELECT name INTO old_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO old_agent_name FROM agents WHERE id = OLD.assigned_agent_id;
    
    -- Registra mudança de lista
    IF OLD.list_id IS DISTINCT FROM NEW.list_id THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            old_value, new_value, list_id, list_name,
            stage_id, stage_name, agent_id, agent_name
        ) VALUES (
            master_id, NEW.id, 'list_changed', 'list_id',
            old_list_name, list_name, NEW.list_id, list_name,
            NEW.stage_id, stage_name, NEW.assigned_agent_id, agent_name
        );
    END IF;
    
    -- Registra mudança de etapa
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            old_value, new_value, list_id, list_name,
            stage_id, stage_name, agent_id, agent_name
        ) VALUES (
            master_id, NEW.id, 'stage_changed', 'stage_id',
            old_stage_name, stage_name, NEW.list_id, list_name,
            NEW.stage_id, stage_name, NEW.assigned_agent_id, agent_name
        );
    END IF;
    
    -- Registra mudança de atendente
    IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            old_value, new_value, list_id, list_name,
            stage_id, stage_name, agent_id, agent_name
        ) VALUES (
            master_id, NEW.id, 'agent_changed', 'assigned_agent_id',
            old_agent_name, agent_name, NEW.list_id, list_name,
            NEW.stage_id, stage_name, NEW.assigned_agent_id, agent_name
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de atendentes
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT DEFAULT '',
    role TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de listas
CREATE TABLE IF NOT EXISTS lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT NOT NULL DEFAULT '#3B82F6',
    distribution_rules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de etapas do pipeline
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    "order" INTEGER NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de tags
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de campos personalizados
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'textarea', 'select', 'number', 'currency', 'date', 'checkbox')),
    required BOOLEAN DEFAULT false,
    options JSONB DEFAULT '[]'::jsonb,
    placeholder TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de contatos (principal)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    company TEXT DEFAULT '',
    instagram TEXT DEFAULT '',
    list_id UUID REFERENCES lists(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}'::jsonb,
    source TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de pastas
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de relacionamento pasta-lista
CREATE TABLE IF NOT EXISTS folder_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(folder_id, list_id)
);

-- Tabela de configurações do dashboard
CREATE TABLE IF NOT EXISTS dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    included_stages_for_total TEXT[] DEFAULT '{}',
    included_stages_for_conversion TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de lead master (histórico consolidado)
CREATE TABLE IF NOT EXISTS lead_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    current_name TEXT NOT NULL,
    first_phone TEXT,
    current_phone TEXT,
    first_company TEXT,
    current_company TEXT,
    first_source TEXT,
    current_source TEXT,
    is_active BOOLEAN DEFAULT true,
    total_interactions INTEGER DEFAULT 1,
    first_created_at TIMESTAMPTZ NOT NULL,
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de histórico de leads
CREATE TABLE IF NOT EXISTS lead_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_master_id UUID REFERENCES lead_master(id) ON DELETE CASCADE,
    contact_id UUID,
    action_type TEXT NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted', 'list_changed', 'stage_changed', 'agent_changed', 'tags_changed')),
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    list_id UUID,
    list_name TEXT,
    stage_id UUID,
    stage_name TEXT,
    agent_id UUID,
    agent_name TEXT,
    tags TEXT[],
    tag_names TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage_id ON contacts(stage_id);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_agent_id ON contacts(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages("order");
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_lists_folder_id ON folder_lists(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_lists_list_id ON folder_lists(list_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_user_id ON dashboard_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_master_email ON lead_master(email);
CREATE INDEX IF NOT EXISTS idx_lead_master_is_active ON lead_master(is_active);
CREATE INDEX IF NOT EXISTS idx_lead_history_lead_master_id ON lead_history(lead_master_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_contact_id ON lead_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_action_type ON lead_history(action_type);
CREATE INDEX IF NOT EXISTS idx_lead_history_created_at ON lead_history(created_at);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_fields_updated_at ON custom_fields;
CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON custom_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_configs_updated_at ON dashboard_configs;
CREATE TRIGGER update_dashboard_configs_updated_at BEFORE UPDATE ON dashboard_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lead_master_updated_at ON lead_master;
CREATE TRIGGER update_lead_master_updated_at BEFORE UPDATE ON lead_master FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers específicos para contatos
DROP TRIGGER IF EXISTS prevent_instagram_fields_trigger ON custom_fields;
CREATE TRIGGER prevent_instagram_fields_trigger BEFORE INSERT OR UPDATE ON custom_fields FOR EACH ROW EXECUTE FUNCTION prevent_instagram_custom_fields();

DROP TRIGGER IF EXISTS clean_instagram_custom_fields_trigger ON contacts;
CREATE TRIGGER clean_instagram_custom_fields_trigger BEFORE INSERT OR UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION clean_instagram_from_custom_fields();

DROP TRIGGER IF EXISTS sync_lead_master_on_insert ON contacts;
CREATE TRIGGER sync_lead_master_on_insert AFTER INSERT ON contacts FOR EACH ROW EXECUTE FUNCTION sync_lead_master();

DROP TRIGGER IF EXISTS track_contact_changes_on_update ON contacts;
CREATE TRIGGER track_contact_changes_on_update AFTER UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION track_contact_changes();

DROP TRIGGER IF EXISTS mark_lead_master_inactive_on_delete ON contacts;
CREATE TRIGGER mark_lead_master_inactive_on_delete AFTER DELETE ON contacts FOR EACH ROW EXECUTE FUNCTION mark_lead_master_inactive();

-- Habilitar RLS onde necessário
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permissivas para desenvolvimento)
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
CREATE POLICY "Allow all operations on users" ON users FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on agents" ON agents;
CREATE POLICY "Allow all operations on agents" ON agents FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on lists" ON lists;
CREATE POLICY "Allow all operations on lists" ON lists FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on pipeline_stages" ON pipeline_stages;
CREATE POLICY "Allow all operations on pipeline_stages" ON pipeline_stages FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on tags" ON tags;
CREATE POLICY "Allow all operations on tags" ON tags FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on custom_fields" ON custom_fields;
CREATE POLICY "Allow all operations on custom_fields" ON custom_fields FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on contacts" ON contacts;
CREATE POLICY "Allow all operations on contacts" ON contacts FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on dashboard_configs" ON dashboard_configs;
CREATE POLICY "Allow all operations on dashboard_configs" ON dashboard_configs FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on lead_master" ON lead_master;
CREATE POLICY "Allow all operations on lead_master" ON lead_master FOR ALL TO public USING (true);

DROP POLICY IF EXISTS "Allow all operations on lead_history" ON lead_history;
CREATE POLICY "Allow all operations on lead_history" ON lead_history FOR ALL TO public USING (true);

-- Políticas específicas para folders (com controle de usuário)
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders" ON folders FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own folders" ON folders;
CREATE POLICY "Users can insert their own folders" ON folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders" ON folders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders" ON folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Políticas para folder_lists
DROP POLICY IF EXISTS "Users can manage their folder lists" ON folder_lists;
CREATE POLICY "Users can manage their folder lists" ON folder_lists FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM folders WHERE folders.id = folder_lists.folder_id AND folders.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM folders WHERE folders.id = folder_lists.folder_id AND folders.user_id = auth.uid()));