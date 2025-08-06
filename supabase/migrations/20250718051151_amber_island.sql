/*
  # Fix RLS policies for pipeline_configs table

  1. Security
    - Enable RLS on pipeline_configs table
    - Add policies for authenticated users to manage their own configs
    - Allow INSERT, SELECT, UPDATE, DELETE for user's own records

  2. Changes
    - Enable Row Level Security
    - Create policy for users to manage their own pipeline configurations
*/

-- Enable RLS on pipeline_configs table
ALTER TABLE pipeline_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own pipeline configs" ON pipeline_configs;

-- Create comprehensive policy for all operations
CREATE POLICY "Users can manage their own pipeline configs"
  ON pipeline_configs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Alternative: Create separate policies for each operation (more granular)
-- Uncomment these if you prefer separate policies:

/*
CREATE POLICY "Users can view their own pipeline configs"
  ON pipeline_configs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own pipeline configs"
  ON pipeline_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pipeline configs"
  ON pipeline_configs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own pipeline configs"
  ON pipeline_configs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
*/