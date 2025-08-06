/*
  # Adicionar usuário demo para autenticação

  1. Usuário Demo
    - Email: demo@crm.com
    - Senha: demo123456
    - Para facilitar testes e demonstração

  2. Configuração
    - Usuário será criado automaticamente
    - Email confirmado por padrão
*/

-- Inserir usuário demo se não existir
DO $$
DECLARE
    demo_user_id uuid;
BEGIN
    -- Verificar se o usuário demo já existe
    SELECT id INTO demo_user_id 
    FROM auth.users 
    WHERE email = 'demo@crm.com';
    
    -- Se não existir, criar o usuário demo
    IF demo_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'demo@crm.com',
            crypt('demo123456', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"name":"Usuário Demo"}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
        
        RAISE NOTICE 'Usuário demo criado com sucesso: demo@crm.com / demo123456';
    ELSE
        RAISE NOTICE 'Usuário demo já existe';
    END IF;
END $$;