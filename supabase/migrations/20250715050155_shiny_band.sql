/*
  # Limpeza Agressiva de Campos Instagram

  1. Remove todos os campos personalizados relacionados ao Instagram
  2. Limpa custom_fields de todos os contatos
  3. Cria trigger para prevenir criação futura
  4. Normaliza dados existentes
*/

-- Remove todos os campos personalizados do Instagram (mais agressivo)
DELETE FROM custom_fields 
WHERE LOWER(name) LIKE '%instagram%' 
   OR LOWER(name) LIKE '%insta%'
   OR type = 'instagram';

-- Limpa custom_fields de todos os contatos removendo qualquer referência ao Instagram
UPDATE contacts 
SET custom_fields = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each(COALESCE(custom_fields, '{}'::jsonb))
  WHERE LOWER(key) NOT LIKE '%instagram%' 
    AND LOWER(key) NOT LIKE '%insta%'
    AND NOT (value::text LIKE '@%' AND length(value::text) < 50)
)
WHERE custom_fields IS NOT NULL 
  AND custom_fields != '{}'::jsonb;

-- Garante que custom_fields nunca seja null
UPDATE contacts 
SET custom_fields = '{}'::jsonb 
WHERE custom_fields IS NULL;

-- Cria função para bloquear criação de campos Instagram
CREATE OR REPLACE FUNCTION prevent_instagram_custom_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Bloqueia criação de campos com nome contendo instagram
  IF LOWER(NEW.name) LIKE '%instagram%' OR LOWER(NEW.name) LIKE '%insta%' THEN
    RAISE EXCEPTION 'Não é permitido criar campos personalizados do Instagram. Use o campo nativo instagram da tabela contacts.';
  END IF;
  
  -- Bloqueia tipo instagram
  IF NEW.type = 'instagram' THEN
    RAISE EXCEPTION 'Tipo instagram não é permitido para campos personalizados. Use o campo nativo instagram da tabela contacts.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para prevenir criação futura
DROP TRIGGER IF EXISTS prevent_instagram_fields_trigger ON custom_fields;
CREATE TRIGGER prevent_instagram_fields_trigger
  BEFORE INSERT OR UPDATE ON custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION prevent_instagram_custom_fields();

-- Cria função para limpar custom_fields automaticamente
CREATE OR REPLACE FUNCTION clean_instagram_from_custom_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove qualquer campo do Instagram dos custom_fields
  IF NEW.custom_fields IS NOT NULL THEN
    NEW.custom_fields := (
      SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
      FROM jsonb_each(NEW.custom_fields)
      WHERE LOWER(key) NOT LIKE '%instagram%' 
        AND LOWER(key) NOT LIKE '%insta%'
        AND NOT (value::text LIKE '@%' AND length(value::text) < 50)
    );
  ELSE
    NEW.custom_fields := '{}'::jsonb;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para limpar automaticamente
DROP TRIGGER IF EXISTS clean_instagram_custom_fields_trigger ON contacts;
CREATE TRIGGER clean_instagram_custom_fields_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION clean_instagram_from_custom_fields();

-- Log da limpeza
DO $$
BEGIN
  RAISE NOTICE 'Limpeza agressiva do Instagram concluída:';
  RAISE NOTICE '- Campos personalizados do Instagram removidos';
  RAISE NOTICE '- Custom fields dos contatos limpos';
  RAISE NOTICE '- Triggers de prevenção criados';
  RAISE NOTICE '- Sistema configurado para usar apenas o campo nativo instagram';
END $$;