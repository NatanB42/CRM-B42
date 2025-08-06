/*
  # Fix Lead History System

  1. Triggers
    - Fix sync_lead_master trigger to properly update current values
    - Fix track_contact_changes trigger to count interactions correctly
    - Add proper change detection for all fields

  2. Functions
    - Update sync_lead_master function to handle all field updates
    - Update track_contact_changes function to properly increment interactions
    - Add better change detection logic

  3. Data Integrity
    - Ensure lead_master is always updated with current values
    - Ensure interaction count is properly incremented
    - Ensure timestamps are correctly updated
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS sync_lead_master_on_insert ON contacts;
DROP TRIGGER IF EXISTS track_contact_changes_on_update ON contacts;
DROP TRIGGER IF EXISTS mark_lead_master_inactive_on_delete ON contacts;

DROP FUNCTION IF EXISTS sync_lead_master();
DROP FUNCTION IF EXISTS track_contact_changes();
DROP FUNCTION IF EXISTS mark_lead_master_inactive();

-- Create improved sync_lead_master function
CREATE OR REPLACE FUNCTION sync_lead_master()
RETURNS TRIGGER AS $$
DECLARE
    existing_master RECORD;
    list_name_val TEXT;
    stage_name_val TEXT;
    agent_name_val TEXT;
    tag_names_val TEXT[];
BEGIN
    -- Get related names for the history record
    SELECT name INTO list_name_val FROM lists WHERE id = NEW.list_id;
    SELECT name INTO stage_name_val FROM pipeline_stages WHERE id = NEW.stage_id;
    SELECT name INTO agent_name_val FROM agents WHERE id = NEW.assigned_agent_id;
    
    -- Get tag names
    SELECT ARRAY(
        SELECT name FROM tags WHERE id = ANY(NEW.tags)
    ) INTO tag_names_val;

    -- Check if lead_master exists for this email
    SELECT * INTO existing_master 
    FROM lead_master 
    WHERE email = NEW.email;

    IF existing_master IS NULL THEN
        -- Create new lead_master record
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

        -- Create history record for creation
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
                'source', NEW.source
            )
        );
    ELSE
        -- Update existing lead_master with current values and increment interactions
        UPDATE lead_master SET
            current_name = NEW.name,
            current_phone = NEW.phone,
            current_company = NEW.company,
            current_source = NEW.source,
            is_active = true,
            total_interactions = total_interactions + 1,
            last_updated_at = NOW()
        WHERE email = NEW.email;

        -- Create history record for re-creation
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
            existing_master.id,
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
                'previous_interactions', existing_master.total_interactions
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create improved track_contact_changes function
CREATE OR REPLACE FUNCTION track_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
    master_id UUID;
    list_name_old TEXT;
    list_name_new TEXT;
    stage_name_old TEXT;
    stage_name_new TEXT;
    agent_name_old TEXT;
    agent_name_new TEXT;
    tag_names_old TEXT[];
    tag_names_new TEXT[];
    has_changes BOOLEAN := false;
BEGIN
    -- Get lead_master_id
    SELECT id INTO master_id FROM lead_master WHERE email = NEW.email;
    
    IF master_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Always update lead_master with current values and increment interactions
    UPDATE lead_master SET
        current_name = NEW.name,
        current_phone = NEW.phone,
        current_company = NEW.company,
        current_source = NEW.source,
        total_interactions = total_interactions + 1,
        last_updated_at = NOW()
    WHERE id = master_id;

    -- Check for specific field changes and create history records
    
    -- Name change
    IF OLD.name != NEW.name THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name, old_value, new_value,
            metadata
        ) VALUES (
            master_id, NEW.id, 'updated', 'name', OLD.name, NEW.name,
            jsonb_build_object('field_type', 'basic_info')
        );
        has_changes := true;
    END IF;

    -- Phone change
    IF COALESCE(OLD.phone, '') != COALESCE(NEW.phone, '') THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name, old_value, new_value,
            metadata
        ) VALUES (
            master_id, NEW.id, 'updated', 'phone', COALESCE(OLD.phone, ''), COALESCE(NEW.phone, ''),
            jsonb_build_object('field_type', 'basic_info')
        );
        has_changes := true;
    END IF;

    -- Company change
    IF COALESCE(OLD.company, '') != COALESCE(NEW.company, '') THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name, old_value, new_value,
            metadata
        ) VALUES (
            master_id, NEW.id, 'updated', 'company', COALESCE(OLD.company, ''), COALESCE(NEW.company, ''),
            jsonb_build_object('field_type', 'basic_info')
        );
        has_changes := true;
    END IF;

    -- Source change
    IF COALESCE(OLD.source, '') != COALESCE(NEW.source, '') THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name, old_value, new_value,
            metadata
        ) VALUES (
            master_id, NEW.id, 'updated', 'source', COALESCE(OLD.source, ''), COALESCE(NEW.source, ''),
            jsonb_build_object('field_type', 'basic_info')
        );
        has_changes := true;
    END IF;

    -- List change
    IF COALESCE(OLD.list_id::text, '') != COALESCE(NEW.list_id::text, '') THEN
        SELECT name INTO list_name_old FROM lists WHERE id = OLD.list_id;
        SELECT name INTO list_name_new FROM lists WHERE id = NEW.list_id;
        
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, old_value, new_value,
            list_id, list_name, metadata
        ) VALUES (
            master_id, NEW.id, 'list_changed', 
            COALESCE(list_name_old, 'Sem lista'), 
            COALESCE(list_name_new, 'Sem lista'),
            NEW.list_id, list_name_new,
            jsonb_build_object('old_list_id', OLD.list_id, 'new_list_id', NEW.list_id)
        );
        has_changes := true;
    END IF;

    -- Stage change
    IF COALESCE(OLD.stage_id::text, '') != COALESCE(NEW.stage_id::text, '') THEN
        SELECT name INTO stage_name_old FROM pipeline_stages WHERE id = OLD.stage_id;
        SELECT name INTO stage_name_new FROM pipeline_stages WHERE id = NEW.stage_id;
        
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, old_value, new_value,
            stage_id, stage_name, metadata
        ) VALUES (
            master_id, NEW.id, 'stage_changed',
            COALESCE(stage_name_old, 'Sem etapa'),
            COALESCE(stage_name_new, 'Sem etapa'),
            NEW.stage_id, stage_name_new,
            jsonb_build_object('old_stage_id', OLD.stage_id, 'new_stage_id', NEW.stage_id)
        );
        has_changes := true;
    END IF;

    -- Agent change
    IF COALESCE(OLD.assigned_agent_id::text, '') != COALESCE(NEW.assigned_agent_id::text, '') THEN
        SELECT name INTO agent_name_old FROM agents WHERE id = OLD.assigned_agent_id;
        SELECT name INTO agent_name_new FROM agents WHERE id = NEW.assigned_agent_id;
        
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, old_value, new_value,
            agent_id, agent_name, metadata
        ) VALUES (
            master_id, NEW.id, 'agent_changed',
            COALESCE(agent_name_old, 'Sem atendente'),
            COALESCE(agent_name_new, 'Sem atendente'),
            NEW.assigned_agent_id, agent_name_new,
            jsonb_build_object('old_agent_id', OLD.assigned_agent_id, 'new_agent_id', NEW.assigned_agent_id)
        );
        has_changes := true;
    END IF;

    -- Tags change
    IF OLD.tags != NEW.tags THEN
        SELECT ARRAY(SELECT name FROM tags WHERE id = ANY(OLD.tags)) INTO tag_names_old;
        SELECT ARRAY(SELECT name FROM tags WHERE id = ANY(NEW.tags)) INTO tag_names_new;
        
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, old_value, new_value,
            tags, tag_names, metadata
        ) VALUES (
            master_id, NEW.id, 'tags_changed',
            COALESCE(array_to_string(tag_names_old, ', '), 'Sem tags'),
            COALESCE(array_to_string(tag_names_new, ', '), 'Sem tags'),
            NEW.tags, tag_names_new,
            jsonb_build_object('old_tags', OLD.tags, 'new_tags', NEW.tags)
        );
        has_changes := true;
    END IF;

    -- Custom fields change
    IF OLD.custom_fields != NEW.custom_fields THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name,
            metadata
        ) VALUES (
            master_id, NEW.id, 'updated', 'custom_fields',
            jsonb_build_object(
                'field_type', 'custom_fields',
                'old_custom_fields', OLD.custom_fields,
                'new_custom_fields', NEW.custom_fields
            )
        );
        has_changes := true;
    END IF;

    -- Notes change
    IF COALESCE(OLD.notes, '') != COALESCE(NEW.notes, '') THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type, field_name, old_value, new_value,
            metadata
        ) VALUES (
            master_id, NEW.id, 'updated', 'notes', 
            COALESCE(OLD.notes, ''), COALESCE(NEW.notes, ''),
            jsonb_build_object('field_type', 'notes')
        );
        has_changes := true;
    END IF;

    -- If no specific changes were detected but function was called, create a general update record
    IF NOT has_changes THEN
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type,
            metadata
        ) VALUES (
            master_id, NEW.id, 'updated',
            jsonb_build_object(
                'field_type', 'general_update',
                'timestamp', NOW()
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create mark_lead_master_inactive function
CREATE OR REPLACE FUNCTION mark_lead_master_inactive()
RETURNS TRIGGER AS $$
DECLARE
    master_id UUID;
BEGIN
    -- Get lead_master_id
    SELECT id INTO master_id FROM lead_master WHERE email = OLD.email;
    
    IF master_id IS NOT NULL THEN
        -- Mark as inactive but don't delete
        UPDATE lead_master SET
            is_active = false,
            last_updated_at = NOW()
        WHERE id = master_id;

        -- Create history record for deletion
        INSERT INTO lead_history (
            lead_master_id, contact_id, action_type,
            metadata
        ) VALUES (
            master_id, OLD.id, 'deleted',
            jsonb_build_object(
                'deleted_contact', jsonb_build_object(
                    'name', OLD.name,
                    'email', OLD.email,
                    'phone', OLD.phone,
                    'company', OLD.company
                ),
                'deletion_timestamp', NOW()
            )
        );
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER sync_lead_master_on_insert
    AFTER INSERT ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION sync_lead_master();

CREATE TRIGGER track_contact_changes_on_update
    AFTER UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION track_contact_changes();

CREATE TRIGGER mark_lead_master_inactive_on_delete
    AFTER DELETE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION mark_lead_master_inactive();