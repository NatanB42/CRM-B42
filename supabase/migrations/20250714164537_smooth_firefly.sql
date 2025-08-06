/*
  # Fix RLS policies for folders table

  1. Security Updates
    - Drop existing restrictive policy on folders table
    - Create proper RLS policies for authenticated users
    - Allow users to manage their own folders (CRUD operations)
    - Ensure user_id matches auth.uid() for all operations

  2. Policy Details
    - INSERT: Users can create folders with their own user_id
    - SELECT: Users can view their own folders
    - UPDATE: Users can update their own folders
    - DELETE: Users can delete their own folders
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage their own folders" ON folders;

-- Create comprehensive RLS policies for folders table
CREATE POLICY "Users can insert their own folders"
  ON folders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON folders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON folders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure RLS is enabled on folders table
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;