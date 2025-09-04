/*
  # Corrigir Triggers de Webhooks de Saída

  1. Funções
    - Criar função para processar webhooks de saída
    - Função para detectar mudanças relevantes nos contatos

  2. Triggers
    - Trigger para novos contatos adicionados à lista
    - Trigger para contatos movidos entre listas
    - Trigger para mudanças de atendente

  3. Segurança
    - Função executada com privilégios de service role
    - Logs detalhados para debugging
*/

-- Função para enviar webhooks de saída
CREATE OR REPLACE FUNCTION send_outgoing_webhooks()
RETURNS TRIGGER AS $$
DECLARE
  list_record RECORD;
  webhook_config JSONB;
  agent_record RECORD;
  payload JSONB;
  webhook_url TEXT;
  webhook_headers JSONB;
  should_send_webhook BOOLEAN := FALSE;
  change_type TEXT := '';
BEGIN
  -- Determinar o tipo de mudança
  IF TG_OP = 'INSERT' THEN
    change_type := 'contact_added_to_list';
    should_send_webhook := TRUE;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Verificar se houve mudança relevante
    IF OLD.list_id IS DISTINCT FROM NEW.list_id THEN
      change_type := 'contact_moved_to_list';
      should_send_webhook := TRUE;
    ELSIF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
      change_type := 'contact_agent_changed';
      should_send_webhook := TRUE;
    ELSIF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      change_type := 'contact_stage_changed';
      should_send_webhook := TRUE;
    END IF;
  END IF;

  -- Se não há mudança relevante, não enviar webhook
  IF NOT should_send_webhook THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Buscar dados da lista (usar NEW.list_id para INSERT/UPDATE)
  SELECT * INTO list_record
  FROM lists 
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);

  -- Se lista não encontrada, não enviar webhook
  IF list_record IS NULL THEN
    RAISE LOG 'Lista não encontrada para webhook: %', COALESCE(NEW.list_id, OLD.list_id);
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Verificar se a lista tem webhooks configurados
  IF list_record.outgoing_webhooks IS NULL OR jsonb_array_length(list_record.outgoing_webhooks) = 0 THEN
    RAISE LOG 'Nenhum webhook configurado para lista: %', list_record.name;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Buscar dados do atendente
  IF COALESCE(NEW.assigned_agent_id, OLD.assigned_agent_id) IS NOT NULL THEN
    SELECT * INTO agent_record
    FROM agents 
    WHERE id = COALESCE(NEW.assigned_agent_id, OLD.assigned_agent_id);
  END IF;

  -- Preparar payload base
  payload := jsonb_build_object(
    'event', change_type,
    'timestamp', NOW(),
    'contact', jsonb_build_object(
      'id', COALESCE(NEW.id, OLD.id),
      'name', COALESCE(NEW.name, OLD.name),
      'email', COALESCE(NEW.email, OLD.email),
      'phone', COALESCE(NEW.phone, OLD.phone, ''),
      'company', COALESCE(NEW.company, OLD.company, ''),
      'instagram', COALESCE(NEW.instagram, OLD.instagram, ''),
      'source', COALESCE(NEW.source, OLD.source, ''),
      'notes', COALESCE(NEW.notes, OLD.notes, ''),
      'custom_fields', COALESCE(NEW.custom_fields, OLD.custom_fields, '{}'),
      'tags', COALESCE(NEW.tags, OLD.tags, '[]'),
      'created_at', COALESCE(NEW.created_at, OLD.created_at),
      'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    ),
    'list', jsonb_build_object(
      'id', list_record.id,
      'name', list_record.name,
      'description', COALESCE(list_record.description, ''),
      'color', list_record.color
    )
  );

  -- Adicionar dados do atendente se disponível
  IF agent_record IS NOT NULL THEN
    payload := payload || jsonb_build_object(
      'assigned_agent', jsonb_build_object(
        'id', agent_record.id,
        'name', agent_record.name,
        'email', agent_record.email,
        'phone', COALESCE(agent_record.phone, ''),
        'role', COALESCE(agent_record.role, ''),
        'is_active', agent_record.is_active
      )
    );
  END IF;

  -- Processar cada webhook da lista
  FOR webhook_config IN SELECT * FROM jsonb_array_elements(list_record.outgoing_webhooks)
  LOOP
    -- Verificar se o webhook está ativo
    IF (webhook_config->>'enabled')::boolean IS FALSE THEN
      RAISE LOG 'Webhook desabilitado, pulando: %', webhook_config->>'url';
      CONTINUE;
    END IF;

    webhook_url := webhook_config->>'url';
    webhook_headers := COALESCE(webhook_config->'headers', '{}');

    -- Validar URL
    IF webhook_url IS NULL OR webhook_url = '' THEN
      RAISE LOG 'URL do webhook inválida, pulando';
      CONTINUE;
    END IF;

    RAISE LOG 'Enviando webhook para: % | Evento: % | Contato: %', 
      webhook_url, change_type, COALESCE(NEW.email, OLD.email);

    -- Chamar Edge Function para enviar webhook
    BEGIN
      PERFORM
        net.http_post(
          url := 'https://your-project.supabase.co/functions/v1/send-contact-webhook',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := jsonb_build_object(
            'webhook_url', webhook_url,
            'webhook_headers', webhook_headers,
            'payload', payload
          )
        );
      
      RAISE LOG 'Webhook enviado com sucesso para: %', webhook_url;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Erro ao enviar webhook para %: %', webhook_url, SQLERRM;
      -- Não falhar a operação principal por causa do webhook
    END;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover triggers existentes se existirem
DROP TRIGGER IF EXISTS trigger_send_contact_webhook ON contacts;

-- Criar trigger para webhooks de saída
CREATE TRIGGER trigger_send_outgoing_webhooks
  AFTER INSERT OR UPDATE OF list_id, stage_id, assigned_agent_id ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION send_outgoing_webhooks();

-- Função para configurar a service role key (deve ser executada uma vez)
-- Esta função permite que os triggers acessem a Edge Function
CREATE OR REPLACE FUNCTION configure_webhook_settings()
RETURNS void AS $$
BEGIN
  -- Esta configuração permite que os triggers chamem Edge Functions
  PERFORM set_config('app.settings.service_role_key', current_setting('SUPABASE_SERVICE_ROLE_KEY', true), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar configuração inicial
SELECT configure_webhook_settings();

-- Criar índices para otimizar performance dos triggers
CREATE INDEX IF NOT EXISTS idx_contacts_list_id_webhook ON contacts(list_id) WHERE list_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_agent_id_webhook ON contacts(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;

-- Função para testar webhooks manualmente (útil para debugging)
CREATE OR REPLACE FUNCTION test_webhook_for_contact(contact_id UUID)
RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
  result JSONB;
BEGIN
  SELECT * INTO contact_record FROM contacts WHERE id = contact_id;
  
  IF contact_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Contato não encontrado');
  END IF;

  -- Simular trigger de INSERT
  PERFORM send_outgoing_webhooks() FROM contacts WHERE id = contact_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Webhook de teste enviado',
    'contact_id', contact_id,
    'contact_email', contact_record.email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;