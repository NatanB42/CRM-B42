/*
  # Seed initial data for CRM system

  1. Sample Data
    - Default agents (sales team)
    - Pipeline stages (sales funnel)
    - Tags for categorization
    - Custom fields for lead data
    - Lists with distribution rules
    - Sample contacts

  2. Data Relationships
    - Contacts linked to lists, stages, and agents
    - Distribution rules configured per list
    - Custom fields populated with sample data
*/

-- Inserir atendentes padrão
INSERT INTO agents (name, email, phone, role, is_active) 
SELECT 'João Silva', 'joao@empresa.com', '(11) 99999-1111', 'Vendedor Sênior', true
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'joao@empresa.com');

INSERT INTO agents (name, email, phone, role, is_active) 
SELECT 'Maria Santos', 'maria@empresa.com', '(11) 99999-2222', 'Vendedora', true
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'maria@empresa.com');

INSERT INTO agents (name, email, phone, role, is_active) 
SELECT 'Pedro Costa', 'pedro@empresa.com', '(11) 99999-3333', 'Vendedor Júnior', true
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE email = 'pedro@empresa.com');

-- Inserir etapas do pipeline
INSERT INTO pipeline_stages (name, color, "order", description) 
SELECT 'Novo Lead', '#6B7280', 1, 'Leads recém chegados'
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Novo Lead');

INSERT INTO pipeline_stages (name, color, "order", description) 
SELECT 'Primeiro Contato', '#3B82F6', 2, 'Primeiro contato realizado'
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Primeiro Contato');

INSERT INTO pipeline_stages (name, color, "order", description) 
SELECT 'Proposta Enviada', '#F59E0B', 3, 'Proposta comercial enviada'
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Proposta Enviada');

INSERT INTO pipeline_stages (name, color, "order", description) 
SELECT 'Negociação', '#EF4444', 4, 'Em processo de negociação'
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Negociação');

INSERT INTO pipeline_stages (name, color, "order", description) 
SELECT 'Fechado', '#10B981', 5, 'Negócio fechado com sucesso'
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Fechado');

-- Inserir tags padrão
INSERT INTO tags (name, color, description) 
SELECT 'Prioridade Alta', '#EF4444', 'Leads com alta prioridade'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'Prioridade Alta');

INSERT INTO tags (name, color, description) 
SELECT 'Interesse Alto', '#10B981', 'Leads com alto interesse'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'Interesse Alto');

INSERT INTO tags (name, color, description) 
SELECT 'Seguimento', '#F59E0B', 'Leads para seguimento'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'Seguimento');

INSERT INTO tags (name, color, description) 
SELECT 'Qualificado', '#8B5CF6', 'Lead qualificado'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'Qualificado');

-- Inserir campos personalizados
INSERT INTO custom_fields (name, type, required, options, placeholder) 
SELECT 'Orçamento', 'currency', false, '[]'::jsonb, 'Ex: 10000.00'
WHERE NOT EXISTS (SELECT 1 FROM custom_fields WHERE name = 'Orçamento');

INSERT INTO custom_fields (name, type, required, options, placeholder) 
SELECT 'Fonte', 'select', true, '["Website", "Facebook", "Google", "Indicação", "LinkedIn", "WhatsApp"]'::jsonb, ''
WHERE NOT EXISTS (SELECT 1 FROM custom_fields WHERE name = 'Fonte');

INSERT INTO custom_fields (name, type, required, options, placeholder) 
SELECT 'Observações', 'textarea', false, '[]'::jsonb, 'Observações adicionais sobre o lead'
WHERE NOT EXISTS (SELECT 1 FROM custom_fields WHERE name = 'Observações');

INSERT INTO custom_fields (name, type, required, options, placeholder) 
SELECT 'Data de Interesse', 'date', false, '[]'::jsonb, ''
WHERE NOT EXISTS (SELECT 1 FROM custom_fields WHERE name = 'Data de Interesse');

-- Inserir listas com regras de distribuição
DO $$
DECLARE
    agent1_id uuid;
    agent2_id uuid;
    agent3_id uuid;
BEGIN
    -- Buscar IDs dos agentes
    SELECT id INTO agent1_id FROM agents WHERE email = 'joao@empresa.com';
    SELECT id INTO agent2_id FROM agents WHERE email = 'maria@empresa.com';
    SELECT id INTO agent3_id FROM agents WHERE email = 'pedro@empresa.com';
    
    -- Inserir listas apenas se os agentes existirem e as listas não existirem
    IF agent1_id IS NOT NULL AND agent2_id IS NOT NULL AND agent3_id IS NOT NULL THEN
        
        -- Lista Leads Gerais
        IF NOT EXISTS (SELECT 1 FROM lists WHERE name = 'Leads Gerais') THEN
            INSERT INTO lists (name, description, color, distribution_rules) VALUES
            ('Leads Gerais', 'Lista principal de leads', '#3B82F6', 
             jsonb_build_array(
                 jsonb_build_object('agentId', agent1_id, 'percentage', 40),
                 jsonb_build_object('agentId', agent2_id, 'percentage', 35),
                 jsonb_build_object('agentId', agent3_id, 'percentage', 25)
             ));
        END IF;
        
        -- Lista Clientes Ativos
        IF NOT EXISTS (SELECT 1 FROM lists WHERE name = 'Clientes Ativos') THEN
            INSERT INTO lists (name, description, color, distribution_rules) VALUES
            ('Clientes Ativos', 'Clientes com contratos ativos', '#10B981',
             jsonb_build_array(
                 jsonb_build_object('agentId', agent1_id, 'percentage', 50),
                 jsonb_build_object('agentId', agent2_id, 'percentage', 50)
             ));
        END IF;
        
        -- Lista Leads Premium
        IF NOT EXISTS (SELECT 1 FROM lists WHERE name = 'Leads Premium') THEN
            INSERT INTO lists (name, description, color, distribution_rules) VALUES
            ('Leads Premium', 'Leads de alto valor', '#8B5CF6',
             jsonb_build_array(
                 jsonb_build_object('agentId', agent1_id, 'percentage', 70),
                 jsonb_build_object('agentId', agent2_id, 'percentage', 30)
             ));
        END IF;
        
    END IF;
END $$;

-- Inserir contatos de exemplo
DO $$
DECLARE
    agent1_id uuid;
    agent2_id uuid;
    stage1_id uuid;
    stage2_id uuid;
    stage3_id uuid;
    list1_id uuid;
    list3_id uuid;
    tag1_id uuid;
    tag2_id uuid;
    tag3_id uuid;
    tag4_id uuid;
    field1_id uuid;
    field2_id uuid;
BEGIN
    -- Buscar IDs necessários
    SELECT id INTO agent1_id FROM agents WHERE email = 'joao@empresa.com';
    SELECT id INTO agent2_id FROM agents WHERE email = 'maria@empresa.com';
    
    SELECT id INTO stage1_id FROM pipeline_stages WHERE "order" = 1;
    SELECT id INTO stage2_id FROM pipeline_stages WHERE "order" = 2;
    SELECT id INTO stage3_id FROM pipeline_stages WHERE "order" = 3;
    
    SELECT id INTO list1_id FROM lists WHERE name = 'Leads Gerais';
    SELECT id INTO list3_id FROM lists WHERE name = 'Leads Premium';
    
    SELECT id INTO tag1_id FROM tags WHERE name = 'Prioridade Alta';
    SELECT id INTO tag2_id FROM tags WHERE name = 'Interesse Alto';
    SELECT id INTO tag3_id FROM tags WHERE name = 'Seguimento';
    SELECT id INTO tag4_id FROM tags WHERE name = 'Qualificado';
    
    SELECT id INTO field1_id FROM custom_fields WHERE name = 'Orçamento';
    SELECT id INTO field2_id FROM custom_fields WHERE name = 'Fonte';
    
    -- Inserir contatos de exemplo apenas se todos os IDs necessários existirem
    IF agent1_id IS NOT NULL AND agent2_id IS NOT NULL AND 
       stage1_id IS NOT NULL AND stage2_id IS NOT NULL AND stage3_id IS NOT NULL AND
       list1_id IS NOT NULL AND list3_id IS NOT NULL AND
       tag1_id IS NOT NULL AND tag2_id IS NOT NULL AND tag3_id IS NOT NULL AND tag4_id IS NOT NULL AND
       field1_id IS NOT NULL AND field2_id IS NOT NULL THEN
        
        -- Contato Ana Silva
        IF NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'ana.silva@exemplo.com') THEN
            INSERT INTO contacts (name, email, phone, company, list_id, stage_id, assigned_agent_id, tags, custom_fields, source, notes) VALUES
            ('Ana Silva', 'ana.silva@exemplo.com', '(11) 98888-1111', 'Tech Solutions', 
             list1_id, stage1_id, agent1_id, 
             ARRAY[tag1_id::text, tag2_id::text],
             jsonb_build_object(field1_id::text, '50000', field2_id::text, 'Website'),
             'Website', 'Interessada em soluções de automação');
        END IF;
        
        -- Contato Carlos Oliveira
        IF NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'carlos@empresa.com.br') THEN
            INSERT INTO contacts (name, email, phone, company, list_id, stage_id, assigned_agent_id, tags, custom_fields, source, notes) VALUES
            ('Carlos Oliveira', 'carlos@empresa.com.br', '(11) 97777-2222', 'Oliveira & Associados',
             list1_id, stage2_id, agent2_id,
             ARRAY[tag3_id::text],
             jsonb_build_object(field1_id::text, '25000', field2_id::text, 'Indicação'),
             'Indicação', 'Primeiro contato realizado, aguardando retorno');
        END IF;
        
        -- Contato Fernanda Costa
        IF NOT EXISTS (SELECT 1 FROM contacts WHERE email = 'fernanda@startup.io') THEN
            INSERT INTO contacts (name, email, phone, company, list_id, stage_id, assigned_agent_id, tags, custom_fields, source, notes) VALUES
            ('Fernanda Costa', 'fernanda@startup.io', '(11) 96666-3333', 'StartupTech',
             list3_id, stage3_id, agent1_id,
             ARRAY[tag1_id::text, tag4_id::text],
             jsonb_build_object(field1_id::text, '100000', field2_id::text, 'LinkedIn'),
             'LinkedIn', 'Proposta enviada para implementação completa');
        END IF;
        
    END IF;
END $$;