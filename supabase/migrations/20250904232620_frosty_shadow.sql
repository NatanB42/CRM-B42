/*
  # Corrigir Chamada da Edge Function nos Triggers

  1. Correções
    - Atualizar URL da Edge Function para usar variável de ambiente
    - Corrigir headers de autenticação
    - Melhorar tratamento de erros

  2. Configuração
    - Configurar URL base do Supabase
    - Configurar service role key
*/

-- Função para configurar variáveis de ambiente necessárias
CREATE OR REPLACE FUNCTION configure_webhook_environment()
RETURNS void AS $$
BEGIN
  -- Configurar URL base do Supabase (substitua pela sua URL real)
  PERFORM set_config('app.settings.supabase_url', 'https://your-project.supabase.co', false);
  
  -- A service role key será configurada automaticamente pelo Supabase
  RAISE LOG 'Configuração de webhook atualizada';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar configuração
SELECT configure_webhook_environment();

-- Função atualizada para enviar webhooks usando http extension
CREATE OR REPLACE FUNCTION send_outgoing_webhooks_http()
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
  supabase_url TEXT;
  service_role_key TEXT;
  edge_function_url TEXT;
  http_request_id BIGINT;
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

  -- Buscar dados da lista
  SELECT * INTO list_record
  FROM lists 
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);

  -- Se lista não encontrada ou sem webhooks, retornar
  IF list_record IS NULL OR 
     list_record.outgoing_webhooks IS NULL OR 
     jsonb_array_length(list_record.outgoing_webhooks) = 0 THEN
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

  -- Obter configurações
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', true);
  
  -- Construir URL da Edge Function
  edge_function_url := supabase_url || '/functions/v1/send-contact-webhook';

  -- Processar cada webhook da lista
  FOR webhook_config IN SELECT * FROM jsonb_array_elements(list_record.outgoing_webhooks)
  LOOP
    -- Verificar se o webhook está ativo
    IF (webhook_config->>'enabled')::boolean IS FALSE THEN
      CONTINUE;
    END IF;

    webhook_url := webhook_config->>'url';
    webhook_headers := COALESCE(webhook_config->'headers', '{}');

    -- Validar URL
    IF webhook_url IS NULL OR webhook_url = '' THEN
      CONTINUE;
    END IF;

    RAISE LOG 'Enviando webhook: % | Evento: % | Contato: %', 
      webhook_url, change_type, COALESCE(NEW.email, OLD.email);

    -- Enviar webhook via Edge Function usando http extension
    BEGIN
      -- Usar a extensão http se disponível
      SELECT http_post(
        edge_function_url,
        jsonb_build_object(
          'webhook_url', webhook_url,
          'webhook_headers', webhook_headers,
          'payload', payload
        ),
        'application/json',
        jsonb_build_object(
          'Authorization', 'Bearer ' || service_role_key
        )
      ) INTO http_request_id;
      
      RAISE LOG 'Webhook request enviado: ID %', http_request_id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Erro ao enviar webhook para %: %', webhook_url, SQLERRM;
      -- Não falhar a operação principal
    END;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar trigger para usar a nova função
DROP TRIGGER IF EXISTS trigger_send_outgoing_webhooks ON contacts;

CREATE TRIGGER trigger_send_outgoing_webhooks
  AFTER INSERT OR UPDATE OF list_id, stage_id, assigned_agent_id ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION send_outgoing_webhooks_http();

-- Função para testar webhook manualmente
CREATE OR REPLACE FUNCTION manual_webhook_test(
  contact_email TEXT,
  webhook_url TEXT,
  webhook_headers JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
  list_record RECORD;
  agent_record RECORD;
  payload JSONB;
  supabase_url TEXT;
  service_role_key TEXT;
  edge_function_url TEXT;
  http_request_id BIGINT;
BEGIN
  -- Buscar contato
  SELECT * INTO contact_record 
  FROM contacts 
  WHERE email = contact_email 
  LIMIT 1;

  IF contact_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Contato não encontrado'
    );
  END IF;

  -- Buscar lista e atendente
  SELECT * INTO list_record FROM lists WHERE id = contact_record.list_id;
  SELECT * INTO agent_record FROM agents WHERE id = contact_record.assigned_agent_id;

  -- Preparar payload
  payload := jsonb_build_object(
    'event', 'manual_test',
    'timestamp', NOW(),
    'contact', jsonb_build_object(
      'id', contact_record.id,
      'name', contact_record.name,
      'email', contact_record.email,
      'phone', COALESCE(contact_record.phone, ''),
      'company', COALESCE(contact_record.company, ''),
      'instagram', COALESCE(contact_record.instagram, ''),
      'source', COALESCE(contact_record.source, ''),
      'notes', COALESCE(contact_record.notes, ''),
      'custom_fields', COALESCE(contact_record.custom_fields, '{}'),
      'tags', COALESCE(contact_record.tags, '[]'),
      'created_at', contact_record.created_at,
      'updated_at', contact_record.updated_at
    ),
    'list', jsonb_build_object(
      'id', COALESCE(list_record.id, ''),
      'name', COALESCE(list_record.name, '')
    )
  );

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

  -- Configurações
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', true);
  edge_function_url := supabase_url || '/functions/v1/send-contact-webhook';

  -- Enviar webhook
  BEGIN
    SELECT http_post(
      edge_function_url,
      jsonb_build_object(
        'webhook_url', webhook_url,
        'webhook_headers', webhook_headers,
        'payload', payload
      ),
      'application/json',
      jsonb_build_object(
        'Authorization', 'Bearer ' || service_role_key
      )
    ) INTO http_request_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Webhook de teste enviado',
      'request_id', http_request_id,
      'payload', payload
    );
    
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'payload', payload
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;