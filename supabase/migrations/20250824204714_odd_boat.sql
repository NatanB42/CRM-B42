/*
  # Fix COALESCE type mismatch errors

  This migration fixes all database triggers and functions that have COALESCE type mismatches
  between text[] (tags) and jsonb (custom_fields) columns.

  1. Drop and recreate problematic trigger functions
  2. Fix type handling in all contact-related triggers
  3. Ensure proper type casting in COALESCE operations
*/

-- Drop existing problematic triggers and functions
DROP TRIGGER IF EXISTS track_detailed_contact_changes_on_update ON contacts;
DROP TRIGGER IF EXISTS trigger_send_contact_webhook ON contacts;
DROP FUNCTION IF EXISTS track_detailed_contact_changes();
DROP FUNCTION IF EXISTS handle_contact_webhook();

-- Recreate the detailed contact changes tracking function with proper type handling
CREATE OR REPLACE FUNCTION track_detailed_contact_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle name changes
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name, 
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'name_changed', 'name',
      OLD.name, NEW.name,
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle email changes
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'email_changed', 'email',
      OLD.email, NEW.email,
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = OLD.email;
  END IF;

  -- Handle phone changes
  IF COALESCE(OLD.phone, '') IS DISTINCT FROM COALESCE(NEW.phone, '') THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'phone_changed', 'phone',
      COALESCE(OLD.phone, ''), COALESCE(NEW.phone, ''),
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle company changes
  IF COALESCE(OLD.company, '') IS DISTINCT FROM COALESCE(NEW.company, '') THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'company_changed', 'company',
      COALESCE(OLD.company, ''), COALESCE(NEW.company, ''),
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle instagram changes
  IF COALESCE(OLD.instagram, '') IS DISTINCT FROM COALESCE(NEW.instagram, '') THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'instagram_changed', 'instagram',
      COALESCE(OLD.instagram, ''), COALESCE(NEW.instagram, ''),
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle list changes
  IF OLD.list_id IS DISTINCT FROM NEW.list_id THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'list_changed', 'list_id',
      OLD.list_id::text, NEW.list_id::text,
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('old_list_name', ol.name, 'new_list_name', l.name, 'timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN lists ol ON ol.id = OLD.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle stage changes
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'stage_changed', 'stage_id',
      OLD.stage_id::text, NEW.stage_id::text,
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('old_stage_name', os.name, 'new_stage_name', s.name, 'timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN pipeline_stages os ON os.id = OLD.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle agent changes
  IF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'agent_changed', 'assigned_agent_id',
      COALESCE(OLD.assigned_agent_id::text, ''), COALESCE(NEW.assigned_agent_id::text, ''),
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('old_agent_name', oa.name, 'new_agent_name', a.name, 'timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    LEFT JOIN agents oa ON oa.id = OLD.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle tags changes (properly handle text[] type)
  IF OLD.tags::text IS DISTINCT FROM NEW.tags::text THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, tags, metadata
    )
    SELECT 
      lm.id, NEW.id, 'tags_changed', 'tags',
      OLD.tags::text, NEW.tags::text,
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name, NEW.tags,
      jsonb_build_object('old_tags', OLD.tags, 'new_tags', NEW.tags, 'timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle custom_fields changes (properly handle jsonb type)
  IF OLD.custom_fields::text IS DISTINCT FROM NEW.custom_fields::text THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'custom_fields_changed', 'custom_fields',
      OLD.custom_fields::text, NEW.custom_fields::text,
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('old_custom_fields', OLD.custom_fields, 'new_custom_fields', NEW.custom_fields, 'timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle source changes
  IF COALESCE(OLD.source, '') IS DISTINCT FROM COALESCE(NEW.source, '') THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'source_changed', 'source',
      COALESCE(OLD.source, ''), COALESCE(NEW.source, ''),
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  -- Handle notes changes
  IF COALESCE(OLD.notes, '') IS DISTINCT FROM COALESCE(NEW.notes, '') THEN
    INSERT INTO lead_history (
      lead_master_id, contact_id, action_type, field_name,
      old_value, new_value, list_id, list_name, stage_id, stage_name,
      agent_id, agent_name, metadata
    )
    SELECT 
      lm.id, NEW.id, 'notes_changed', 'notes',
      COALESCE(OLD.notes, ''), COALESCE(NEW.notes, ''),
      NEW.list_id, l.name, NEW.stage_id, s.name,
      NEW.assigned_agent_id, a.name,
      jsonb_build_object('timestamp', now())
    FROM lead_master lm
    LEFT JOIN lists l ON l.id = NEW.list_id
    LEFT JOIN pipeline_stages s ON s.id = NEW.stage_id
    LEFT JOIN agents a ON a.id = NEW.assigned_agent_id
    WHERE lm.email = NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the webhook handling function with proper type handling
CREATE OR REPLACE FUNCTION handle_contact_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_config jsonb;
  webhook_url text;
  webhook_headers jsonb;
  event_type text;
  contact_data jsonb;
  list_data jsonb;
  stage_data jsonb;
  agent_data jsonb;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'contact_added_to_list';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.list_id IS DISTINCT FROM NEW.list_id THEN
      event_type := 'contact_added_to_list';
    ELSIF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      event_type := 'contact_stage_changed';
    ELSIF OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id THEN
      event_type := 'contact_agent_changed';
    ELSE
      -- No relevant changes for webhooks
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get list data and webhooks
  SELECT 
    jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'description', l.description,
      'color', l.color
    ),
    l.outgoing_webhooks
  INTO list_data, webhook_config
  FROM lists l 
  WHERE l.id = COALESCE(NEW.list_id, OLD.list_id);

  -- Get stage data
  SELECT 
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'color', s.color,
      'order', s.order
    )
  INTO stage_data
  FROM pipeline_stages s 
  WHERE s.id = COALESCE(NEW.stage_id, OLD.stage_id);

  -- Get agent data
  SELECT 
    jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'email', a.email
    )
  INTO agent_data
  FROM agents a 
  WHERE a.id = COALESCE(NEW.assigned_agent_id, OLD.assigned_agent_id);

  -- Build contact data (handle types properly)
  contact_data := jsonb_build_object(
    'id', COALESCE(NEW.id, OLD.id),
    'name', COALESCE(NEW.name, OLD.name),
    'email', COALESCE(NEW.email, OLD.email),
    'phone', COALESCE(NEW.phone, OLD.phone, ''),
    'company', COALESCE(NEW.company, OLD.company, ''),
    'instagram', COALESCE(NEW.instagram, OLD.instagram, ''),
    'tags', COALESCE(NEW.tags, OLD.tags, ARRAY[]::text[]),
    'custom_fields', COALESCE(NEW.custom_fields, OLD.custom_fields, '{}'::jsonb),
    'source', COALESCE(NEW.source, OLD.source, ''),
    'notes', COALESCE(NEW.notes, OLD.notes, ''),
    'created_at', COALESCE(NEW.created_at, OLD.created_at),
    'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
  );

  -- Process each webhook
  IF webhook_config IS NOT NULL AND jsonb_array_length(webhook_config) > 0 THEN
    FOR webhook_url, webhook_headers IN 
      SELECT 
        (webhook->>'url')::text,
        COALESCE(webhook->'headers', '{}'::jsonb)
      FROM jsonb_array_elements(webhook_config) AS webhook
      WHERE webhook->>'url' IS NOT NULL
    LOOP
      BEGIN
        -- Call the edge function to send webhook
        PERFORM net.http_post(
          url := format('%s/functions/v1/send-contact-webhook', current_setting('app.supabase_url')),
          headers := jsonb_build_object(
            'Authorization', format('Bearer %s', current_setting('app.supabase_service_role_key')),
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'webhook_url', webhook_url,
            'webhook_headers', webhook_headers,
            'event_type', event_type,
            'contact', contact_data,
            'list', list_data,
            'stage', stage_data,
            'agent', agent_data,
            'timestamp', now()
          )
        );
        
        RAISE LOG 'Webhook enviado: % para %', event_type, webhook_url;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Erro ao enviar webhook para %: %', webhook_url, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER track_detailed_contact_changes_on_update
  AFTER UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION track_detailed_contact_changes();

CREATE TRIGGER trigger_send_contact_webhook
  AFTER INSERT OR UPDATE OF list_id, stage_id, assigned_agent_id ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION handle_contact_webhook();

-- Ensure the net extension is available for HTTP requests
CREATE EXTENSION IF NOT EXISTS http;