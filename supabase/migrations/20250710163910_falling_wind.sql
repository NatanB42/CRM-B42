/*
  # Update custom fields type constraint

  1. Changes
    - Add 'instagram' to the allowed types for custom_fields.type
    - This allows creating Instagram username fields

  2. Security
    - Maintains existing RLS policies
*/

-- Drop existing constraint
ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_type_check;

-- Add new constraint with instagram type
ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_type_check 
  CHECK (type IN ('text', 'textarea', 'select', 'number', 'currency', 'date', 'checkbox', 'instagram'));