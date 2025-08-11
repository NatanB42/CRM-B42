/*
  # Add outgoing webhooks column to lists table

  1. Schema Changes
    - Add `outgoing_webhooks` column to `lists` table
    - Column type: JSONB to store array of webhook configurations
    - Default value: empty array

  2. Purpose
    - Store webhook URLs and configurations for each list
    - Enable automatic webhook notifications when contacts are added/updated
    - Support multiple webhooks per list with individual enable/disable settings
*/

-- Add outgoing webhooks column to lists table
ALTER TABLE public.lists
ADD COLUMN IF NOT EXISTS outgoing_webhooks JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.lists.outgoing_webhooks IS 'Array of webhook configurations for sending contact data to external systems';