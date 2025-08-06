# CRM Supabase - Sistema Plug-and-Play

Sistema CRM completo integrado com Supabase, totalmente autossustentável e plug-and-play.

## 🚀 Funcionalidades

- **Dashboard** com métricas e atividades recentes
- **Gestão de Contatos** com campos personalizados
- **Listas organizadas** com funis individuais
- **Pipeline de vendas** com drag & drop
- **Gestão de Atendentes** 
- **Distribuição automática** por lista com porcentagens
- **Tags e campos personalizados**
- **Webhook** via Supabase Edge Functions
- **Banco de dados na nuvem** com Supabase

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- Conta no Supabase

## 🛠️ Configuração

### 1. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Vá para Settings > API
3. Copie a URL do projeto e a chave anônima
4. Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

### 2. Aplicar Migrações

1. No painel do Supabase, vá para SQL Editor
2. Execute o conteúdo do arquivo `supabase/migrations/create_initial_schema.sql`
3. Execute o conteúdo do arquivo `supabase/migrations/seed_initial_data.sql`

### 3. Configurar Edge Function (Webhook)

1. No painel do Supabase, vá para Edge Functions
2. Crie uma nova função chamada `webhook-contacts`
3. Cole o código do arquivo `supabase/functions/webhook-contacts/index.ts`
4. Faça o deploy da função

### 4. Instalar e Executar

```bash
# Instalar dependências
npm install

# Executar aplicação
npm run dev
```

## 🎯 Acesso

- **Aplicação**: http://localhost:5173
- **Supabase Dashboard**: https://app.supabase.com
- **Webhook**: https://seu-projeto.supabase.co/functions/v1/webhook-contacts

## 📊 Dados Pré-configurados

O sistema já vem com dados de exemplo:

### Atendentes:
- João Silva (Vendedor Sênior)
- Maria Santos (Vendedora)  
- Pedro Costa (Vendedor Júnior)

### Listas com Distribuição:
- **Leads Gerais**: João 40%, Maria 35%, Pedro 25%
- **Clientes Ativos**: João 50%, Maria 50%
- **Leads Premium**: João 70%, Maria 30%

### Pipeline:
1. Novo Lead
2. Primeiro Contato
3. Proposta Enviada
4. Negociação
5. Fechado

### Tags:
- Prioridade Alta
- Interesse Alto
- Seguimento
- Qualificado

### Campos Personalizados:
- Orçamento (moeda)
- Fonte (seleção)
- Observações (texto longo)
- Data de Interesse (data)

## 🔄 Sistema Autossustentável

O sistema é **100% plug-and-play**:

✅ **Migrações Automáticas**: Todas as tabelas são criadas via SQL
✅ **Dados Iniciais**: Sistema já vem populado com dados de exemplo
✅ **Relacionamentos**: Todas as relações entre tabelas configuradas
✅ **Índices**: Otimizações de performance aplicadas
✅ **Validações**: Regras de negócio implementadas
✅ **Distribuição Inteligente**: Algoritmo de distribuição já configurado
✅ **Edge Functions**: Webhook serverless integrado

## 🆕 Novos Campos Personalizados

Quando você criar novos campos personalizados:

1. **Criação Automática**: Campo é salvo no Supabase
2. **Interface Dinâmica**: Aparece automaticamente nos formulários
3. **Validação**: Regras de validação aplicadas
4. **Webhook**: Novos campos são aceitos automaticamente

## 🔧 Estrutura do Banco

### Tabelas Criadas Automaticamente:

#### `agents` (Atendentes)
- id, name, email, phone, role, is_active
- Índices: email único, is_active

#### `lists` (Listas)  
- id, name, description, color, distribution_rules
- distribution_rules: JSONB com regras de distribuição

#### `pipeline_stages` (Etapas)
- id, name, color, order, description
- Índices: order para ordenação

#### `contacts` (Contatos)
- id, name, email, phone, company, list_id, stage_id, assigned_agent_id
- tags (array), custom_fields (JSONB)
- Índices: list_id, stage_id, assigned_agent_id, email

#### `tags` (Tags)
- id, name, color, description

#### `custom_fields` (Campos Personalizados)
- id, name, type, required, options, placeholder
- Tipos: text, textarea, select, number, currency, date, checkbox

## 🚀 Recursos Avançados

### Distribuição Inteligente
- **Por Lista**: Cada lista tem suas regras
- **Balanceamento**: Algoritmo mantém proporção ao longo do tempo
- **Flexível**: Suporta qualquer porcentagem

### Webhook Serverless
- **Edge Function**: Roda na infraestrutura do Supabase
- **Validação Completa**: Todos os campos validados
- **Distribuição Automática**: Aplica regras da lista
- **Logs Detalhados**: Facilita debugging
- **Resposta JSON**: Confirma sucesso/erro

### Interface Dinâmica
- **Campos Personalizados**: Renderização automática baseada no tipo
- **Drag & Drop**: Pipeline com arrastar e soltar
- **Filtros Avançados**: Busca por múltiplos critérios
- **Responsivo**: Funciona em qualquer dispositivo

## 🔗 Webhook para Receber Leads

### Endpoint
```
POST https://seu-projeto.supabase.co/functions/v1/webhook-contacts
```

### Headers
```
Content-Type: application/json
Authorization: Bearer sua_chave_anonima
```

### Exemplo de requisição
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com", 
  "phone": "(11) 99999-9999",
  "company": "Empresa XYZ",
  "source": "Website",
  "listId": "lista_id_opcional",
  "customFields": {
    "campo1": "valor1"
  },
  "notes": "Observações do lead"
}
```

### Campos obrigatórios
- `name`: Nome do contato
- `email`: Email do contato

### Campos opcionais
- `phone`: Telefone
- `company`: Empresa
- `source`: Fonte do lead
- `listId`: ID da lista (se não informado, usa a primeira lista)
- `stageId`: ID da etapa (se não informado, usa a primeira etapa)
- `assignedAgentId`: ID do atendente (se não informado, usa distribuição automática)
- `customFields`: Objeto com campos personalizados
- `notes`: Observações
- `tags`: Array com IDs das tags

## 📊 Distribuição Automática

O sistema distribui automaticamente os leads entre os atendentes baseado nas regras configuradas em cada lista:

1. **Por Lista**: Cada lista tem suas próprias regras de distribuição
2. **Por Porcentagem**: Configure a porcentagem de leads que cada atendente deve receber
3. **Balanceamento**: O algoritmo garante que a distribuição seja equilibrada ao longo do tempo

## 🎯 Como Usar

1. **Configure Supabase**: Crie projeto e configure variáveis de ambiente
2. **Execute Migrações**: Aplique os scripts SQL no Supabase
3. **Configure Edge Function**: Deploy do webhook serverless
4. **Configure Atendentes**: Cadastre os atendentes na aba "Atendentes"
5. **Crie Listas**: Configure listas com regras de distribuição
6. **Configure Pipeline**: Defina as etapas do seu funil de vendas
7. **Receba Leads**: Use o webhook para receber leads automaticamente
8. **Gerencie Funil**: Arraste contatos entre as etapas do pipeline

## 🔧 Scripts Disponíveis

- `npm run dev` - Inicia a aplicação em modo desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Preview do build de produção

## 📝 Notas Importantes

- Certifique-se de que as variáveis de ambiente estão configuradas
- Execute as migrações SQL no painel do Supabase
- Configure a Edge Function para o webhook funcionar
- Os dados são armazenados na nuvem no Supabase
- Faça backup regular via exportação de dados

## 🆘 Solução de Problemas

### Erro de conexão com Supabase
- Verifique se as variáveis de ambiente estão corretas
- Confirme se as migrações foram aplicadas

### Webhook não funciona
- Verifique se a Edge Function foi deployada
- Confirme se a URL do webhook está correta

### Dados não aparecem
- Verifique o console do navegador para erros
- Confirme se as tabelas do Supabase foram criadas corretamente

## 🌟 Vantagens do Supabase

- **Serverless**: Sem necessidade de gerenciar servidor
- **Escalável**: Cresce automaticamente com sua demanda
- **Seguro**: RLS (Row Level Security) habilitado
- **Real-time**: Atualizações em tempo real (futuro)
- **Edge Functions**: Webhooks serverless integrados
- **Dashboard**: Interface administrativa completa