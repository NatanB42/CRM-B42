/*
  # Limpeza de campos personalizados do Instagram

  1. Remove campos personalizados do tipo 'instagram'
  2. Remove campos personalizados com nome contendo 'instagram'
  3. Garante que apenas o campo nativo 'instagram' da tabela contacts seja usado

  ## Ações:
  - DELETE campos personalizados incorretos do Instagram
  - Limpa dados de custom_fields que referenciam Instagram
*/

-- Remove campos personalizados do tipo 'instagram' ou com nome contendo 'instagram'
DELETE FROM custom_fields 
WHERE type = 'instagram' 
   OR LOWER(name) LIKE '%instagram%';

-- Limpa referências de Instagram dos custom_fields dos contatos
-- Mantém apenas o campo nativo 'instagram' da tabela contacts
UPDATE contacts 
SET custom_fields = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each(custom_fields)
  WHERE key NOT IN (
    SELECT id::text 
    FROM custom_fields 
    WHERE type = 'instagram' OR LOWER(name) LIKE '%instagram%'
  )
)
WHERE custom_fields IS NOT NULL 
  AND custom_fields != '{}'::jsonb;

-- Garantir que contatos com custom_fields vazios tenham um objeto vazio
UPDATE contacts 
SET custom_fields = '{}'::jsonb 
WHERE custom_fields IS NULL;