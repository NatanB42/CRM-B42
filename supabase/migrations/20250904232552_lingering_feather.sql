/*
  # Funções de Debug para Webhooks

  1. Funções de Debug
    - Verificar status dos triggers
    - Testar webhooks manualmente
    - Logs de webhook (simulado)

  2. Funções Utilitárias
    - Verificar configuração de webhooks
    - Validar URLs de webhook
*/

-- Função para verificar status dos triggers de webhook
CREATE OR REPLACE FUNCTION check_webhook_triggers()
RETURNS TABLE(
  trigger_name TEXT,
  table_name TEXT,
  function_name TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.trigger_name::TEXT,
    t.event_object_table::TEXT,
    t.action_statement::TEXT,
    (t.trigger_name IS NOT NULL)::BOOLEAN
  FROM information_schema.triggers t
  WHERE t.trigger_name LIKE '%webhook%'
    AND t.event_object_schema = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar configuração de webhooks por lista
CREATE OR REPLACE FUNCTION check_list_webhooks()
RETURNS TABLE(
  list_id UUID,
  list_name TEXT,
  webhook_count INTEGER,
  active_webhook_count INTEGER,
  webhook_urls TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    COALESCE(jsonb_array_length(l.outgoing_webhooks), 0)::INTEGER,
    COALESCE(
      (SELECT COUNT(*)::INTEGER 
       FROM jsonb_array_elements(l.outgoing_webhooks) AS webhook
       WHERE (webhook->>'enabled')::BOOLEAN IS NOT FALSE), 
      0
    ),
    COALESCE(
      ARRAY(
        SELECT webhook->>'url'
        FROM jsonb_array_elements(l.outgoing_webhooks) AS webhook
        WHERE (webhook->>'enabled')::BOOLEAN IS NOT FALSE
      ),
      ARRAY[]::TEXT[]
    )
  FROM lists l
  WHERE l.outgoing_webhooks IS NOT NULL 
    AND jsonb_array_length(l.outgoing_webhooks) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para simular disparo de webhook para um contato específico
CREATE OR REPLACE FUNCTION simulate_webhook_for_contact(
  contact_email TEXT,
  event_type TEXT DEFAULT 'contact_added_to_list'
)
RETURNS JSONB AS $$
DECLARE
  contact_record RECORD;
  list_record RECORD;
  agent_record RECORD;
  webhook_config JSONB;
  payload JSONB;
  result JSONB := '[]'::JSONB;
BEGIN
  -- Buscar contato
  SELECT * INTO contact_record 
  FROM contacts 
  WHERE email = contact_email 
  LIMIT 1;

  IF contact_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Contato não encontrado',
      'email', contact_email
    );
  END IF;

  -- Buscar lista
  SELECT * INTO list_record
  FROM lists 
  WHERE id = contact_record.list_id;

  IF list_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Lista não encontrada para o contato',
      'contact_id', contact_record.id
    );
  END IF;

  -- Verificar se há webhooks configurados
  IF list_record.outgoing_webhooks IS NULL OR jsonb_array_length(list_record.outgoing_webhooks) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nenhum webhook configurado para esta lista',
      'list_name', list_record.name
    );
  END IF;

  -- Buscar atendente se atribuído
  IF contact_record.assigned_agent_id IS NOT NULL THEN
    SELECT * INTO agent_record
    FROM agents 
    WHERE id = contact_record.assigned_agent_id;
  END IF;

  -- Preparar payload
  payload := jsonb_build_object(
    'event', event_type,
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

  -- Simular envio para cada webhook ativo
  FOR webhook_config IN SELECT * FROM jsonb_array_elements(list_record.outgoing_webhooks)
  LOOP
    IF (webhook_config->>'enabled')::boolean IS NOT FALSE THEN
      result := result || jsonb_build_array(
        jsonb_build_object(
          'webhook_url', webhook_config->>'url',
          'headers', COALESCE(webhook_config->'headers', '{}'),
          'payload', payload,
          'simulated', true,
          'timestamp', NOW()
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'contact_email', contact_email,
    'list_name', list_record.name,
    'webhooks_to_send', jsonb_array_length(result),
    'webhooks', result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se a Edge Function está acessível
CREATE OR REPLACE FUNCTION test_edge_function_connectivity()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Esta função pode ser expandida para testar conectividade
  -- Por enquanto, apenas retorna informações sobre a configuração
  
  SELECT jsonb_build_object(
    'supabase_url', current_setting('app.settings.supabase_url', true),
    'service_role_configured', (current_setting('app.settings.service_role_key', true) IS NOT NULL),
    'timestamp', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;