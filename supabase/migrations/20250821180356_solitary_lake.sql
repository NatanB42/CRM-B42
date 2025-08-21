/*
  # Corrigir Sistema de Webhooks de Saída

  1. Funções
    - Atualizar função `handle_contact_webhook` para processar webhooks de saída
    - Criar função para enviar webhooks via Edge Function

  2. Triggers
    - Atualizar trigger para capturar eventos de criação e mudança de etapa
    - Garantir que webhooks sejam enviados automaticamente

  3. Melhorias
    - Suporte completo para webhooks de saída por lista
    - Eventos: contact_added_to_list, contact_stage_changed
    - Dados completos do contato, lista, etapa e agente
*/

-- Função para enviar webhooks de saída via Edge Function
CREATE OR REPLACE FUNCTION send_outgoing_webhooks(
  p_contact_id uuid,
  p_list_id uuid,
  p_event_type text DEFAULT 'contact_added_to_list'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  webhook_config jsonb;
  webhook_url text;
  webhook_enabled boolean;
  webhook_headers jsonb;
  contact_data jsonb;
  list_data jsonb;
  agent_data jsonb;
  stage_data jsonb;
  payload jsonb;
  webhook_item jsonb;
BEGIN
  -- Log do início da função
  RAISE LOG 'send_outgoing_webhooks: Iniciando para contato % na lista % (evento: %)', p_contact_id, p_list_id, p_event_type;

  -- Buscar dados da lista e seus webhooks
  SELECT 
    jsonb_build_object(
      'id', id,
      'name', name,
      'description', description,
      'color', color
    ),
    outgoing_webhooks
  INTO list_data, webhook_config
  FROM lists 
  WHERE id = p_list_id;

  -- Verificar se a lista existe
  IF list_data IS NULL THEN
    RAISE LOG 'send_outgoing_webhooks: Lista % não encontrada', p_list_id;
    RETURN;
  END IF;

  -- Verificar se há webhooks configurados
  IF webhook_config IS NULL OR jsonb_array_length(webhook_config) = 0 THEN
    RAISE LOG 'send_outgoing_webhooks: Nenhum webhook configurado para lista %', p_list_id;
    RETURN;
  END IF;

  -- Buscar dados completos do contato
  SELECT jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'email', c.email,
    'phone', COALESCE(c.phone, ''),
    'company', COALESCE(c.company, ''),
    'instagram', COALESCE(c.instagram, ''),
    'source', COALESCE(c.source, ''),
    'notes', COALESCE(c.notes, ''),
    'tags', COALESCE(c.tags, '[]'::jsonb),
    'custom_fields', COALESCE(c.custom_fields, '{}'::jsonb),
    'created_at', c.created_at,
    'updated_at', c.updated_at
  )
  INTO contact_data
  FROM contacts c
  WHERE c.id = p_contact_id;

  -- Verificar se o contato existe
  IF contact_data IS NULL THEN
    RAISE LOG 'send_outgoing_webhooks: Contato % não encontrado', p_contact_id;
    RETURN;
  END IF;

  -- Buscar dados do agente atribuído
  SELECT jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'email', a.email,
    'phone', COALESCE(a.phone, ''),
    'role', COALESCE(a.role, '')
  )
  INTO agent_data
  FROM contacts c
  LEFT JOIN agents a ON a.id = c.assigned_agent_id
  WHERE c.id = p_contact_id AND a.id IS NOT NULL;

  -- Buscar dados da etapa atual
  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'color', s.color,
    'order', s.order,
    'description', COALESCE(s.description, '')
  )
  INTO stage_data
  FROM contacts c
  LEFT JOIN pipeline_stages s ON s.id = c.stage_id
  WHERE c.id = p_contact_id AND s.id IS NOT NULL;

  -- Construir payload base
  payload := jsonb_build_object(
    'event', p_event_type,
    'timestamp', now(),
    'contact', contact_data,
    'list', list_data,
    'stage', stage_data,
    'assigned_agent', agent_data
  );

  RAISE LOG 'send_outgoing_webhooks: Payload construído: %', payload;

  -- Processar cada webhook configurado
  FOR i IN 0..jsonb_array_length(webhook_config) - 1 LOOP
    webhook_item := webhook_config -> i;
    webhook_url := webhook_item ->> 'url';
    webhook_enabled := COALESCE((webhook_item ->> 'enabled')::boolean, true);
    webhook_headers := COALESCE(webhook_item -> 'headers', '{}'::jsonb);

    -- Verificar se o webhook está ativo e tem URL
    IF webhook_enabled AND webhook_url IS NOT NULL AND webhook_url != '' THEN
      RAISE LOG 'send_outgoing_webhooks: Enviando webhook para URL: %', webhook_url;
      
      -- Chamar Edge Function para enviar webhook
      PERFORM net.http_post(
        url := format('%s/functions/v1/send-contact-webhook', current_setting('app.supabase_url')),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', format('Bearer %s', current_setting('app.supabase_service_role_key'))
        ),
        body := jsonb_build_object(
          'webhook_url', webhook_url,
          'webhook_headers', webhook_headers,
          'payload', payload
        )
      );
      
      RAISE LOG 'send_outgoing_webhooks: Webhook enviado para %', webhook_url;
    ELSE
      RAISE LOG 'send_outgoing_webhooks: Webhook desabilitado ou sem URL: %', webhook_item;
    END IF;
  END LOOP;

  RAISE LOG 'send_outgoing_webhooks: Processamento concluído para contato %', p_contact_id;
END;
$$;

-- Função atualizada para handle_contact_webhook
CREATE OR REPLACE FUNCTION handle_contact_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  event_type text;
  old_list_id uuid;
  new_list_id uuid;
  old_stage_id uuid;
  new_stage_id uuid;
BEGIN
  -- Determinar tipo de evento
  IF TG_OP = 'INSERT' THEN
    event_type := 'contact_added_to_list';
    new_list_id := NEW.list_id;
    
    RAISE LOG 'handle_contact_webhook: INSERT - Contato % adicionado à lista %', NEW.id, new_list_id;
    
    -- Enviar webhook para a lista de destino
    IF new_list_id IS NOT NULL THEN
      PERFORM send_outgoing_webhooks(NEW.id, new_list_id, event_type);
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_list_id := OLD.list_id;
    new_list_id := NEW.list_id;
    old_stage_id := OLD.stage_id;
    new_stage_id := NEW.stage_id;
    
    -- Mudança de lista
    IF old_list_id IS DISTINCT FROM new_list_id THEN
      RAISE LOG 'handle_contact_webhook: UPDATE - Contato % movido da lista % para lista %', NEW.id, old_list_id, new_list_id;
      
      IF new_list_id IS NOT NULL THEN
        PERFORM send_outgoing_webhooks(NEW.id, new_list_id, 'contact_added_to_list');
      END IF;
    END IF;
    
    -- Mudança de etapa (apenas se não houve mudança de lista)
    IF old_list_id = new_list_id AND old_stage_id IS DISTINCT FROM new_stage_id THEN
      RAISE LOG 'handle_contact_webhook: UPDATE - Contato % mudou de etapa % para etapa %', NEW.id, old_stage_id, new_stage_id;
      
      IF new_list_id IS NOT NULL THEN
        PERFORM send_outgoing_webhooks(NEW.id, new_list_id, 'contact_stage_changed');
      END IF;
    END IF;
    
    -- Mudança de agente atribuído
    IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
      RAISE LOG 'handle_contact_webhook: UPDATE - Contato % mudou de agente % para agente %', NEW.id, OLD.assigned_agent_id, NEW.assigned_agent_id;
      
      IF new_list_id IS NOT NULL THEN
        PERFORM send_outgoing_webhooks(NEW.id, new_list_id, 'contact_agent_changed');
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar o trigger com eventos mais específicos
DROP TRIGGER IF EXISTS trigger_send_contact_webhook ON contacts;

CREATE TRIGGER trigger_send_contact_webhook
  AFTER INSERT OR UPDATE OF list_id, stage_id, assigned_agent_id ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION handle_contact_webhook();

-- Comentário do trigger atualizado
COMMENT ON TRIGGER trigger_send_contact_webhook ON contacts IS 
'Trigger que dispara webhooks de saída quando contatos são inseridos ou quando list_id, stage_id ou assigned_agent_id são atualizados';