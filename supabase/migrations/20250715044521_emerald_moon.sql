/*
  # Adicionar coluna Instagram na tabela contacts

  1. Alterações na tabela
    - Adiciona coluna `instagram` na tabela `contacts`
    - Campo opcional (nullable) do tipo text
    - Migra dados existentes do campo customFields.instagram

  2. Migração de dados
    - Move valores existentes de custom_fields.instagram para a nova coluna
    - Remove o campo instagram de custom_fields após migração
*/

-- Adicionar coluna instagram na tabela contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram text;

-- Migrar dados existentes do custom_fields.instagram para a nova coluna
UPDATE contacts 
SET instagram = (custom_fields->>'instagram')::text
WHERE custom_fields ? 'instagram' 
  AND custom_fields->>'instagram' IS NOT NULL 
  AND custom_fields->>'instagram' != '';

-- Remover o campo instagram do custom_fields após migração
UPDATE contacts 
SET custom_fields = custom_fields - 'instagram'
WHERE custom_fields ? 'instagram';

-- Adicionar comentário na coluna
COMMENT ON COLUMN contacts.instagram IS 'Instagram username or handle';