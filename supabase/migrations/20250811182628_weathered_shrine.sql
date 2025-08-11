/*
  # Create webhook trigger function and trigger

  1. New Functions
    - `handle_contact_webhook()` - Trigger function to call Edge Function
    - Executes when contacts are inserted or updated

  2. New Triggers
    - `trigger_send_contact_webhook` - Fires on contact INSERT/UPDATE
    - Calls webhook Edge Function for outgoing notifications

  3. Security
    - Function uses SECURITY DEFINER for elevated permissions
    - Calls Edge Function with proper authentication
*/

-- Create function to handle contact webhook calls
CREATE OR REPLACE FUNCTION public.handle_contact_webhook()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT;
    payload JSONB;
    response_status INT;
    response_body TEXT;
    supabase_url TEXT;
BEGIN
    -- Get Supabase URL from environment or construct it
    supabase_url := current_setting('app.settings.supabase_url', true);
    
    -- If not set, try to construct from current database URL
    IF supabase_url IS NULL OR supabase_url = '' THEN
        -- This is a fallback - you should set the proper URL
        supabase_url := 'https://your-project.supabase.co';
    END IF;
    
    -- Prepare the payload for the Edge Function
    payload := jsonb_build_object(
        'contact_id', NEW.id,
        'list_id', NEW.list_id,
        'agent_id', NEW.assigned_agent_id
    );

    -- Call the Edge Function using http extension
    -- Note: This requires the http extension to be enabled
    BEGIN
        SELECT
            status::int,
            content::text
        INTO
            response_status,
            response_body
        FROM
            net.http_post(
                url := supabase_url || '/functions/v1/send-contact-webhook',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
                ),
                body := payload
            );

        -- Log the response for debugging
        RAISE NOTICE 'Webhook Edge Function call status: %', response_status;
        RAISE NOTICE 'Webhook Edge Function call body: %', response_body;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the main operation
        RAISE WARNING 'Failed to call webhook Edge Function: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for contact webhooks
DROP TRIGGER IF EXISTS trigger_send_contact_webhook ON public.contacts;

CREATE TRIGGER trigger_send_contact_webhook
    AFTER INSERT OR UPDATE OF list_id, assigned_agent_id ON public.contacts
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_contact_webhook();

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_contact_webhook() IS 'Trigger function that calls Edge Function to send outgoing webhooks when contacts are added or updated';
COMMENT ON TRIGGER trigger_send_contact_webhook ON public.contacts IS 'Trigger that fires webhook notifications when contacts are inserted or their list/agent is updated';