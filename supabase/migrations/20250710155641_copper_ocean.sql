/*
  # Simple Authentication System

  1. Remove dependency on auth.users
    - Drop existing users table that references auth.users
    - Create new simple users table in public schema
    
  2. New Users Table
    - `id` (uuid, primary key)
    - `email` (text, unique)
    - `name` (text)
    - `password` (text, plain text)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  3. Security
    - Enable RLS on users table
    - Add policies for user access
    - Remove auth dependencies

  4. Sample Data
    - Create demo user for testing
*/

-- Drop existing users table if it exists
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop existing triggers and functions related to auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create new simple users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Allow all operations on users" ON public.users FOR ALL USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert demo user
INSERT INTO public.users (email, name, password) VALUES
('demo@crm.com', 'Usuário Demo', 'demo123456')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password;

-- Insert additional demo users
INSERT INTO public.users (email, name, password) VALUES
('admin@crm.com', 'Administrador', 'admin123'),
('user@crm.com', 'Usuário Teste', 'user123')
ON CONFLICT (email) DO NOTHING;