/*
  # Adicionar sistema de organização em pastas

  1. Nova Tabela
    - `folders`
      - `id` (uuid, primary key)
      - `name` (text, nome da pasta)
      - `color` (text, cor da pasta)
      - `user_id` (uuid, referência ao usuário)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Nova Tabela de Relacionamento
    - `folder_lists`
      - `id` (uuid, primary key)
      - `folder_id` (uuid, referência à pasta)
      - `list_id` (uuid, referência à lista)
      - `created_at` (timestamp)

  3. Segurança
    - Enable RLS em ambas as tabelas
    - Políticas para usuários autenticados
*/

-- Criar tabela de pastas
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de relacionamento pasta-lista
CREATE TABLE IF NOT EXISTS folder_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(folder_id, list_id)
);

-- Habilitar RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_lists ENABLE ROW LEVEL SECURITY;

-- Políticas para folders
CREATE POLICY "Users can manage their own folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas para folder_lists
CREATE POLICY "Users can manage their folder lists"
  ON folder_lists
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM folders 
      WHERE folders.id = folder_lists.folder_id 
      AND folders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders 
      WHERE folders.id = folder_lists.folder_id 
      AND folders.user_id = auth.uid()
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_lists_folder_id ON folder_lists(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_lists_list_id ON folder_lists(list_id);

-- Trigger para updated_at
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();