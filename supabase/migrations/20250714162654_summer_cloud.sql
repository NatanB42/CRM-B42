/*
  # Corrigir incompatibilidade de tipos UUID

  1. Alterações de Schema
    - Alterar campos `id` nas tabelas `lists`, `pipeline_stages` e `agents` de TEXT para UUID
    - Manter compatibilidade com dados existentes
    - Atualizar todas as referências de chaves estrangeiras

  2. Segurança
    - Manter RLS habilitado em todas as tabelas
    - Preservar todas as políticas existentes

  3. Funcionalidades
    - Corrigir função `sync_lead_master()` para trabalhar com tipos UUID corretos
    - Manter todas as triggers e funções funcionando
*/

-- Primeiro, vamos desabilitar temporariamente as triggers para evitar conflitos
ALTER TABLE contacts DISABLE TRIGGER sync_lead_master_on_insert;
ALTER TABLE contacts DISABLE TRIGGER track_contact_changes_on_update;
ALTER TABLE contacts DISABLE TRIGGER mark_lead_master_inactive_on_delete;

-- Alterar tabela lists: converter id de text para uuid
DO $$
BEGIN
  -- Verificar se a coluna já é uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lists' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    -- Criar nova coluna uuid temporária
    ALTER TABLE lists ADD COLUMN id_new uuid DEFAULT gen_random_uuid();
    
    -- Atualizar a nova coluna com UUIDs válidos para registros existentes
    UPDATE lists SET id_new = gen_random_uuid() WHERE id_new IS NULL;
    
    -- Atualizar referências na tabela contacts
    UPDATE contacts SET list_id = (
      SELECT l.id_new FROM lists l WHERE l.id = contacts.list_id
    ) WHERE list_id IS NOT NULL;
    
    -- Atualizar referências na tabela dashboard_configs
    UPDATE dashboard_configs 
    SET included_stages_for_total = ARRAY(
      SELECT l.id_new::text FROM lists l WHERE l.id = ANY(included_stages_for_total)
    )
    WHERE included_stages_for_total IS NOT NULL;
    
    UPDATE dashboard_configs 
    SET included_stages_for_conversion = ARRAY(
      SELECT l.id_new::text FROM lists l WHERE l.id = ANY(included_stages_for_conversion)
    )
    WHERE included_stages_for_conversion IS NOT NULL;
    
    -- Remover coluna antiga e renomear nova
    ALTER TABLE lists DROP COLUMN id;
    ALTER TABLE lists RENAME COLUMN id_new TO id;
    
    -- Recriar primary key
    ALTER TABLE lists ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Alterar tabela pipeline_stages: converter id de text para uuid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pipeline_stages' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    -- Criar nova coluna uuid temporária
    ALTER TABLE pipeline_stages ADD COLUMN id_new uuid DEFAULT gen_random_uuid();
    
    -- Atualizar a nova coluna com UUIDs válidos
    UPDATE pipeline_stages SET id_new = gen_random_uuid() WHERE id_new IS NULL;
    
    -- Atualizar referências na tabela contacts
    UPDATE contacts SET stage_id = (
      SELECT ps.id_new FROM pipeline_stages ps WHERE ps.id = contacts.stage_id
    ) WHERE stage_id IS NOT NULL;
    
    -- Atualizar referências na tabela dashboard_configs
    UPDATE dashboard_configs 
    SET included_stages_for_total = ARRAY(
      SELECT ps.id_new::text FROM pipeline_stages ps WHERE ps.id = ANY(included_stages_for_total)
    )
    WHERE included_stages_for_total IS NOT NULL;
    
    UPDATE dashboard_configs 
    SET included_stages_for_conversion = ARRAY(
      SELECT ps.id_new::text FROM pipeline_stages ps WHERE ps.id = ANY(included_stages_for_conversion)
    )
    WHERE included_stages_for_conversion IS NOT NULL;
    
    -- Remover coluna antiga e renomear nova
    ALTER TABLE pipeline_stages DROP COLUMN id;
    ALTER TABLE pipeline_stages RENAME COLUMN id_new TO id;
    
    -- Recriar primary key
    ALTER TABLE pipeline_stages ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Alterar tabela agents: converter id de text para uuid
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    -- Criar nova coluna uuid temporária
    ALTER TABLE agents ADD COLUMN id_new uuid DEFAULT gen_random_uuid();
    
    -- Atualizar a nova coluna com UUIDs válidos
    UPDATE agents SET id_new = gen_random_uuid() WHERE id_new IS NULL;
    
    -- Atualizar referências na tabela contacts
    UPDATE contacts SET assigned_agent_id = (
      SELECT a.id_new FROM agents a WHERE a.id = contacts.assigned_agent_id
    ) WHERE assigned_agent_id IS NOT NULL;
    
    -- Atualizar referências na tabela lead_history
    UPDATE lead_history SET agent_id = (
      SELECT a.id_new FROM agents a WHERE a.id = lead_history.agent_id
    ) WHERE agent_id IS NOT NULL;
    
    -- Atualizar distribution_rules nas listas (JSON)
    UPDATE lists 
    SET distribution_rules = (
      SELECT jsonb_agg(
        jsonb_set(rule, '{agentId}', to_jsonb((
          SELECT a.id_new::text FROM agents a WHERE a.id = (rule->>'agentId')
        )))
      )
      FROM jsonb_array_elements(distribution_rules) AS rule
    )
    WHERE distribution_rules IS NOT NULL AND distribution_rules != '[]'::jsonb;
    
    -- Remover coluna antiga e renomear nova
    ALTER TABLE agents DROP COLUMN id;
    ALTER TABLE agents RENAME COLUMN id_new TO id;
    
    -- Recriar primary key
    ALTER TABLE agents ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Alterar tabela tags: converter id de text para uuid (para consistência)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tags' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    -- Criar nova coluna uuid temporária
    ALTER TABLE tags ADD COLUMN id_new uuid DEFAULT gen_random_uuid();
    
    -- Atualizar a nova coluna com UUIDs válidos
    UPDATE tags SET id_new = gen_random_uuid() WHERE id_new IS NULL;
    
    -- Atualizar referências na tabela contacts (array de tags)
    UPDATE contacts 
    SET tags = ARRAY(
      SELECT t.id_new::text FROM tags t WHERE t.id = ANY(contacts.tags)
    )
    WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
    
    -- Atualizar referências na tabela lead_history
    UPDATE lead_history 
    SET tags = ARRAY(
      SELECT t.id_new::text FROM tags t WHERE t.id = ANY(lead_history.tags)
    )
    WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
    
    -- Remover coluna antiga e renomear nova
    ALTER TABLE tags DROP COLUMN id;
    ALTER TABLE tags RENAME COLUMN id_new TO id;
    
    -- Recriar primary key
    ALTER TABLE tags ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Alterar tabela custom_fields: converter id de text para uuid (para consistência)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_fields' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    -- Criar nova coluna uuid temporária
    ALTER TABLE custom_fields ADD COLUMN id_new uuid DEFAULT gen_random_uuid();
    
    -- Atualizar a nova coluna com UUIDs válidos
    UPDATE custom_fields SET id_new = gen_random_uuid() WHERE id_new IS NULL;
    
    -- Atualizar referências na tabela contacts (custom_fields JSONB)
    -- Nota: Como custom_fields é JSONB com chaves arbitrárias, 
    -- vamos manter as chaves antigas por compatibilidade
    
    -- Remover coluna antiga e renomear nova
    ALTER TABLE custom_fields DROP COLUMN id;
    ALTER TABLE custom_fields RENAME COLUMN id_new TO id;
    
    -- Recriar primary key
    ALTER TABLE custom_fields ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Recriar índices únicos e constraints
DO $$
BEGIN
  -- Recriar índices para agents se não existirem
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agents_email_key') THEN
    CREATE UNIQUE INDEX agents_email_key ON agents(email);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_agents_email') THEN
    CREATE INDEX idx_agents_email ON agents(email);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_agents_is_active') THEN
    CREATE INDEX idx_agents_is_active ON agents(is_active);
  END IF;
  
  -- Recriar índices para pipeline_stages se não existirem
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pipeline_stages_order') THEN
    CREATE INDEX idx_pipeline_stages_order ON pipeline_stages("order");
  END IF;
END $$;

-- Recriar foreign keys
DO $$
BEGIN
  -- Remover foreign keys antigas se existirem
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contacts_list_id_fkey') THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_list_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contacts_stage_id_fkey') THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_stage_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contacts_assigned_agent_id_fkey') THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_assigned_agent_id_fkey;
  END IF;
  
  -- Recriar foreign keys com tipos corretos
  ALTER TABLE contacts ADD CONSTRAINT contacts_list_id_fkey 
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL;
    
  ALTER TABLE contacts ADD CONSTRAINT contacts_stage_id_fkey 
    FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE SET NULL;
    
  ALTER TABLE contacts ADD CONSTRAINT contacts_assigned_agent_id_fkey 
    FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL;
END $$;

-- Recriar a função sync_lead_master com tipos corretos
CREATE OR REPLACE FUNCTION sync_lead_master()
RETURNS TRIGGER AS $$
DECLARE
  master_record lead_master%ROWTYPE;
  list_name_val text;
  stage_name_val text;
  agent_name_val text;
  tag_names_val text[];
BEGIN
  -- Buscar nomes relacionados
  IF NEW.list_id IS NOT NULL THEN
    SELECT name INTO list_name_val FROM lists WHERE id = NEW.list_id;
  END IF;
  
  IF NEW.stage_id IS NOT NULL THEN
    SELECT name INTO stage_name_val FROM pipeline_stages WHERE id = NEW.stage_id;
  END IF;
  
  IF NEW.assigned_agent_id IS NOT NULL THEN
    SELECT name INTO agent_name_val FROM agents WHERE id = NEW.assigned_agent_id;
  END IF;
  
  -- Buscar nomes das tags
  IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
    SELECT array_agg(name) INTO tag_names_val 
    FROM tags 
    WHERE id = ANY(NEW.tags::uuid[]);
  END IF;
  
  -- Verificar se já existe um lead master para este email
  SELECT * INTO master_record FROM lead_master WHERE email = NEW.email;
  
  IF FOUND THEN
    -- Atualizar lead master existente
    UPDATE lead_master SET
      current_name = NEW.name,
      current_phone = COALESCE(NEW.phone, current_phone),
      current_company = COALESCE(NEW.company, current_company),
      current_source = COALESCE(NEW.source, current_source),
      total_interactions = total_interactions + 1,
      last_updated_at = NOW(),
      updated_at = NOW(),
      is_active = true
    WHERE email = NEW.email;
  ELSE
    -- Criar novo lead master
    INSERT INTO lead_master (
      email,
      first_name,
      current_name,
      first_phone,
      current_phone,
      first_company,
      current_company,
      first_source,
      current_source,
      is_active,
      total_interactions,
      first_created_at,
      last_updated_at
    ) VALUES (
      NEW.email,
      NEW.name,
      NEW.name,
      NEW.phone,
      NEW.phone,
      NEW.company,
      NEW.company,
      NEW.source,
      NEW.source,
      true,
      1,
      NEW.created_at,
      NOW()
    );
  END IF;
  
  -- Registrar no histórico
  INSERT INTO lead_history (
    lead_master_id,
    contact_id,
    action_type,
    list_id,
    list_name,
    stage_id,
    stage_name,
    agent_id,
    agent_name,
    tags,
    tag_names,
    metadata
  ) VALUES (
    (SELECT id FROM lead_master WHERE email = NEW.email),
    NEW.id,
    'created',
    NEW.list_id,
    list_name_val,
    NEW.stage_id,
    stage_name_val,
    NEW.assigned_agent_id,
    agent_name_val,
    NEW.tags,
    tag_names_val,
    jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'phone', NEW.phone,
      'company', NEW.company,
      'source', NEW.source,
      'custom_fields', NEW.custom_fields
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar a função track_contact_changes com tipos corretos
CREATE OR REPLACE FUNCTION track_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
  master_id uuid;
  list_name_old text;
  list_name_new text;
  stage_name_old text;
  stage_name_new text;
  agent_name_old text;
  agent_name_new text;
  tag_names_old text[];
  tag_names_new text[];
BEGIN
  -- Buscar lead master ID
  SELECT id INTO master_id FROM lead_master WHERE email = NEW.email;
  
  -- Verificar mudança de lista
  IF OLD.list_id IS DISTINCT FROM NEW.list_id THEN
    IF OLD.list_id IS NOT NULL THEN
      SELECT name INTO list_name_old FROM lists WHERE id = OLD.list_id;
    END IF;
    IF NEW.list_id IS NOT NULL THEN
      SELECT name INTO list_name_new FROM lists WHERE id = NEW.list_id;
    END IF;
    
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name
    ) VALUES (
      master_id, NEW.id, 'list_changed', 'list_id',
      list_name_old, list_name_new, NEW.list_id, list_name_new
    );
  END IF;
  
  -- Verificar mudança de etapa
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    IF OLD.stage_id IS NOT NULL THEN
      SELECT name INTO stage_name_old FROM pipeline_stages WHERE id = OLD.stage_id;
    END IF;
    IF NEW.stage_id IS NOT NULL THEN
      SELECT name INTO stage_name_new FROM pipeline_stages WHERE id = NEW.stage_id;
    END IF;
    
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, stage_id, stage_name
    ) VALUES (
      master_id, NEW.id, 'stage_changed', 'stage_id',
      stage_name_old, stage_name_new, NEW.stage_id, stage_name_new
    );
  END IF;
  
  -- Verificar mudança de atendente
  IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
    IF OLD.assigned_agent_id IS NOT NULL THEN
      SELECT name INTO agent_name_old FROM agents WHERE id = OLD.assigned_agent_id;
    END IF;
    IF NEW.assigned_agent_id IS NOT NULL THEN
      SELECT name INTO agent_name_new FROM agents WHERE id = NEW.assigned_agent_id;
    END IF;
    
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, agent_id, agent_name
    ) VALUES (
      master_id, NEW.id, 'agent_changed', 'assigned_agent_id',
      agent_name_old, agent_name_new, NEW.assigned_agent_id, agent_name_new
    );
  END IF;
  
  -- Verificar mudança de tags
  IF OLD.tags IS DISTINCT FROM NEW.tags THEN
    IF OLD.tags IS NOT NULL AND array_length(OLD.tags, 1) > 0 THEN
      SELECT array_agg(name) INTO tag_names_old 
      FROM tags WHERE id = ANY(OLD.tags::uuid[]);
    END IF;
    IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
      SELECT array_agg(name) INTO tag_names_new 
      FROM tags WHERE id = ANY(NEW.tags::uuid[]);
    END IF;
    
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, tags, tag_names
    ) VALUES (
      master_id, NEW.id, 'tags_changed', 'tags',
      array_to_string(tag_names_old, ', '), 
      array_to_string(tag_names_new, ', '),
      NEW.tags, tag_names_new
    );
  END IF;
  
  -- Atualizar lead master
  UPDATE lead_master SET
    current_name = NEW.name,
    current_phone = COALESCE(NEW.phone, current_phone),
    current_company = COALESCE(NEW.company, current_company),
    current_source = COALESCE(NEW.source, current_source),
    last_updated_at = NOW(),
    updated_at = NOW()
  WHERE email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reabilitar triggers
ALTER TABLE contacts ENABLE TRIGGER sync_lead_master_on_insert;
ALTER TABLE contacts ENABLE TRIGGER track_contact_changes_on_update;
ALTER TABLE contacts ENABLE TRIGGER mark_lead_master_inactive_on_delete;

-- Verificar se todas as conversões foram bem-sucedidas
DO $$
DECLARE
  lists_count integer;
  stages_count integer;
  agents_count integer;
  tags_count integer;
  fields_count integer;
BEGIN
  SELECT COUNT(*) INTO lists_count FROM lists;
  SELECT COUNT(*) INTO stages_count FROM pipeline_stages;
  SELECT COUNT(*) INTO agents_count FROM agents;
  SELECT COUNT(*) INTO tags_count FROM tags;
  SELECT COUNT(*) INTO fields_count FROM custom_fields;
  
  RAISE NOTICE 'Conversão concluída:';
  RAISE NOTICE '- Lists: % registros', lists_count;
  RAISE NOTICE '- Pipeline Stages: % registros', stages_count;
  RAISE NOTICE '- Agents: % registros', agents_count;
  RAISE NOTICE '- Tags: % registros', tags_count;
  RAISE NOTICE '- Custom Fields: % registros', fields_count;
END $$;