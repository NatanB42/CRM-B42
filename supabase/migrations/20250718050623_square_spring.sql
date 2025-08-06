/*
  # Melhorias no Sistema de Rastreamento de Leads

  1. Novas Tabelas
    - `pipeline_configs` - Configurações personalizadas por funil/lista
    
  2. Melhorias nas Tabelas Existentes
    - Expansão do `lead_history` para capturar mais tipos de mudanças
    - Novos campos no `lead_master` para melhor rastreamento
    
  3. Triggers Aprimorados
    - Rastreamento completo de mudanças em contatos
    - Atualização automática do lead master
    
  4. Índices de Performance
    - Otimizações para consultas de histórico
*/

-- Criar tabela de configurações do pipeline por lista
CREATE TABLE IF NOT EXISTS pipeline_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  visible_stages jsonb DEFAULT '[]'::jsonb,
  stage_order jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(list_id, user_id)
);

-- Índices para pipeline_configs
CREATE INDEX IF NOT EXISTS idx_pipeline_configs_list_id ON pipeline_configs(list_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_configs_user_id ON pipeline_configs(user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_pipeline_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pipeline_configs_updated_at
  BEFORE UPDATE ON pipeline_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_pipeline_configs_updated_at();

-- Expandir tipos de ação no lead_history
DO $$
BEGIN
  -- Verificar se a constraint existe antes de tentar alterá-la
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'lead_history_action_type_check'
  ) THEN
    ALTER TABLE lead_history DROP CONSTRAINT lead_history_action_type_check;
  END IF;
END $$;

-- Adicionar nova constraint com mais tipos de ação
ALTER TABLE lead_history ADD CONSTRAINT lead_history_action_type_check 
CHECK (action_type = ANY (ARRAY[
  'created'::text, 
  'updated'::text, 
  'deleted'::text, 
  'restored'::text,
  'list_changed'::text, 
  'stage_changed'::text, 
  'agent_changed'::text, 
  'tags_changed'::text,
  'name_changed'::text,
  'email_changed'::text,
  'phone_changed'::text,
  'company_changed'::text,
  'instagram_changed'::text,
  'custom_fields_changed'::text,
  'source_changed'::text,
  'notes_changed'::text
]));

-- Adicionar campos ao lead_master para melhor rastreamento
DO $$
BEGIN
  -- Adicionar campo para contagem de eventos se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_master' AND column_name = 'total_events'
  ) THEN
    ALTER TABLE lead_master ADD COLUMN total_events integer DEFAULT 0;
  END IF;
  
  -- Adicionar campo para data de última atividade se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_master' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE lead_master ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Função aprimorada para rastrear mudanças detalhadas
CREATE OR REPLACE FUNCTION track_detailed_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
  lead_master_record RECORD;
  change_detected BOOLEAN := FALSE;
BEGIN
  -- Buscar ou criar lead master
  SELECT * INTO lead_master_record 
  FROM lead_master 
  WHERE email = COALESCE(NEW.email, OLD.email);
  
  IF NOT FOUND THEN
    -- Criar novo lead master se não existir
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
      first_created_at,
      total_events,
      last_activity_at
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
      NEW.created_at,
      1,
      now()
    ) RETURNING * INTO lead_master_record;
    
    change_detected := TRUE;
  END IF;

  -- Rastrear mudanças específicas
  IF TG_OP = 'UPDATE' THEN
    -- Nome mudou
    IF OLD.name != NEW.name THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'name_changed', 'name',
        OLD.name, NEW.name, 
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
      
      -- Atualizar nome atual no lead master
      UPDATE lead_master 
      SET current_name = NEW.name, last_activity_at = now()
      WHERE id = lead_master_record.id;
    END IF;

    -- Email mudou
    IF OLD.email != NEW.email THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'email_changed', 'email',
        OLD.email, NEW.email,
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
    END IF;

    -- Telefone mudou
    IF COALESCE(OLD.phone, '') != COALESCE(NEW.phone, '') THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'phone_changed', 'phone',
        COALESCE(OLD.phone, ''), COALESCE(NEW.phone, ''),
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
      
      -- Atualizar telefone atual no lead master
      UPDATE lead_master 
      SET current_phone = NEW.phone, last_activity_at = now()
      WHERE id = lead_master_record.id;
    END IF;

    -- Empresa mudou
    IF COALESCE(OLD.company, '') != COALESCE(NEW.company, '') THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'company_changed', 'company',
        COALESCE(OLD.company, ''), COALESCE(NEW.company, ''),
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
      
      -- Atualizar empresa atual no lead master
      UPDATE lead_master 
      SET current_company = NEW.company, last_activity_at = now()
      WHERE id = lead_master_record.id;
    END IF;

    -- Instagram mudou
    IF COALESCE(OLD.instagram, '') != COALESCE(NEW.instagram, '') THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'instagram_changed', 'instagram',
        COALESCE(OLD.instagram, ''), COALESCE(NEW.instagram, ''),
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
    END IF;

    -- Fonte mudou
    IF COALESCE(OLD.source, '') != COALESCE(NEW.source, '') THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'source_changed', 'source',
        COALESCE(OLD.source, ''), COALESCE(NEW.source, ''),
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
      
      -- Atualizar fonte atual no lead master
      UPDATE lead_master 
      SET current_source = NEW.source, last_activity_at = now()
      WHERE id = lead_master_record.id;
    END IF;

    -- Observações mudaram
    IF COALESCE(OLD.notes, '') != COALESCE(NEW.notes, '') THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'notes_changed', 'notes',
        COALESCE(OLD.notes, ''), COALESCE(NEW.notes, ''),
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
    END IF;

    -- Campos personalizados mudaram
    IF COALESCE(OLD.custom_fields, '{}'::jsonb) != COALESCE(NEW.custom_fields, '{}'::jsonb) THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'custom_fields_changed', 'custom_fields',
        COALESCE(OLD.custom_fields, '{}'::jsonb)::text, 
        COALESCE(NEW.custom_fields, '{}'::jsonb)::text,
        jsonb_build_object(
          'timestamp', now(), 
          'user_action', true,
          'old_fields', OLD.custom_fields,
          'new_fields', NEW.custom_fields
        ),
        now()
      );
      change_detected := TRUE;
    END IF;

    -- Tags mudaram
    IF COALESCE(OLD.tags, ARRAY[]::text[]) != COALESCE(NEW.tags, ARRAY[]::text[]) THEN
      INSERT INTO lead_history (
        lead_master_id, contact_id, action_type, field_name,
        old_value, new_value, tags, metadata, created_at
      ) VALUES (
        lead_master_record.id, NEW.id, 'tags_changed', 'tags',
        array_to_string(COALESCE(OLD.tags, ARRAY[]::text[]), ','),
        array_to_string(COALESCE(NEW.tags, ARRAY[]::text[]), ','),
        NEW.tags,
        jsonb_build_object('timestamp', now(), 'user_action', true),
        now()
      );
      change_detected := TRUE;
    END IF;
  END IF;

  -- Atualizar contadores se houve mudanças
  IF change_detected THEN
    UPDATE lead_master 
    SET 
      total_events = total_events + 1,
      total_interactions = total_interactions + 1,
      last_activity_at = now(),
      last_updated_at = now()
    WHERE id = lead_master_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Substituir o trigger existente
DROP TRIGGER IF EXISTS track_contact_changes_on_update ON contacts;
CREATE TRIGGER track_detailed_contact_changes_on_update
  AFTER UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION track_detailed_contact_changes();

-- Trigger para rastrear criação de contatos
CREATE OR REPLACE FUNCTION track_contact_creation()
RETURNS TRIGGER AS $$
DECLARE
  lead_master_record RECORD;
  list_name TEXT;
  stage_name TEXT;
  agent_name TEXT;
BEGIN
  -- Buscar nomes relacionados
  SELECT name INTO list_name FROM lists WHERE id = NEW.list_id;
  SELECT name INTO stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
  SELECT name INTO agent_name FROM agents WHERE id = NEW.assigned_agent_id;

  -- Buscar ou criar lead master
  SELECT * INTO lead_master_record 
  FROM lead_master 
  WHERE email = NEW.email;
  
  IF NOT FOUND THEN
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
      first_created_at,
      total_events,
      total_interactions,
      last_activity_at
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
      NEW.created_at,
      1,
      1,
      now()
    ) RETURNING * INTO lead_master_record;
  ELSE
    -- Atualizar lead master existente
    UPDATE lead_master 
    SET 
      current_name = NEW.name,
      current_phone = NEW.phone,
      current_company = NEW.company,
      current_source = NEW.source,
      total_events = total_events + 1,
      total_interactions = total_interactions + 1,
      last_activity_at = now(),
      last_updated_at = now(),
      is_active = true
    WHERE id = lead_master_record.id;
  END IF;

  -- Registrar criação no histórico
  INSERT INTO lead_history (
    lead_master_id, contact_id, action_type,
    list_id, list_name, stage_id, stage_name,
    agent_id, agent_name, tags,
    metadata, created_at
  ) VALUES (
    lead_master_record.id, NEW.id, 'created',
    NEW.list_id, list_name, NEW.stage_id, stage_name,
    NEW.assigned_agent_id, agent_name, NEW.tags,
    jsonb_build_object(
      'timestamp', now(),
      'contact_data', jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'phone', NEW.phone,
        'company', NEW.company,
        'source', NEW.source
      )
    ),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de criação
DROP TRIGGER IF EXISTS sync_lead_master_on_insert ON contacts;
CREATE TRIGGER track_contact_creation_on_insert
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION track_contact_creation();

-- Trigger para rastrear deleção de contatos
CREATE OR REPLACE FUNCTION track_contact_deletion()
RETURNS TRIGGER AS $$
DECLARE
  lead_master_record RECORD;
  list_name TEXT;
  stage_name TEXT;
  agent_name TEXT;
BEGIN
  -- Buscar nomes relacionados
  SELECT name INTO list_name FROM lists WHERE id = OLD.list_id;
  SELECT name INTO stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
  SELECT name INTO agent_name FROM agents WHERE id = OLD.assigned_agent_id;

  -- Buscar lead master
  SELECT * INTO lead_master_record 
  FROM lead_master 
  WHERE email = OLD.email;
  
  IF FOUND THEN
    -- Registrar deleção no histórico
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type,
      list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, tags,
      metadata, created_at
    ) VALUES (
      lead_master_record.id, OLD.id, 'deleted',
      OLD.list_id, list_name, OLD.stage_id, stage_name,
      OLD.assigned_agent_id, agent_name, OLD.tags,
      jsonb_build_object(
        'timestamp', now(),
        'deleted_contact_data', jsonb_build_object(
          'name', OLD.name,
          'email', OLD.email,
          'phone', OLD.phone,
          'company', OLD.company,
          'source', OLD.source
        )
      ),
      now()
    );

    -- Atualizar contadores no lead master
    UPDATE lead_master 
    SET 
      total_events = total_events + 1,
      last_activity_at = now(),
      last_updated_at = now()
    WHERE id = lead_master_record.id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de deleção
DROP TRIGGER IF EXISTS mark_lead_master_inactive_on_delete ON contacts;
CREATE TRIGGER track_contact_deletion_on_delete
  AFTER DELETE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION track_contact_deletion();

-- Atualizar contadores existentes no lead_master
UPDATE lead_master 
SET total_events = (
  SELECT COUNT(*) 
  FROM lead_history 
  WHERE lead_master_id = lead_master.id
)
WHERE total_events = 0 OR total_events IS NULL;

-- Políticas de segurança para pipeline_configs
ALTER TABLE pipeline_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pipeline configs"
  ON pipeline_configs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_lead_history_action_type_created_at ON lead_history(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_master_last_activity ON lead_master(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_master_total_events ON lead_master(total_events DESC);