import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// UUID validation utility
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Clean UUID value - returns valid UUID or null
function cleanUUID(value: string | null | undefined): string | null {
  if (!value || !isValidUUID(value)) {
    return null;
  }
  return value;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const contactData = await req.json()
    
    console.log('📥 Webhook recebido:', contactData)
    
    // Validate required fields
    if (!contactData.name || !contactData.email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nome e email são obrigatórios'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check for duplicates in the target list
    let targetListId = cleanUUID(contactData.listId)
    if (!targetListId) {
      const { data: lists } = await supabaseClient
        .from('lists')
        .select('id')
        .limit(1)
      targetListId = cleanUUID(lists?.[0]?.id)
    }

    if (targetListId) {
      // Build the filter conditions properly with quoted values
      let filterConditions = `email.eq."${contactData.email}"`
      if (contactData.phone && contactData.phone.trim() !== '') {
        filterConditions += `,phone.eq."${contactData.phone}"`
      }
      
      const { data: existingContacts } = await supabaseClient
        .from('contacts')
        .select('id, name, email, phone')
        .eq('list_id', targetListId)
        .or(filterConditions)
      
      if (existingContacts && existingContacts.length > 0) {
        // Update existing contact instead of creating duplicate
        const existingContact = existingContacts[0]
        
        const { data: updatedContact, error: updateError } = await supabaseClient
          .from('contacts')
          .update({
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone || '',
            company: contactData.company || '',
            instagram: contactData.instagram || '',
            custom_fields: contactData.customFields || {},
            source: contactData.source || 'Webhook',
            notes: contactData.notes || ''
          })
          .eq('id', existingContact.id)
          .select()
          .single()
        
        if (updateError) {
          console.error('❌ Erro ao atualizar contato:', updateError)
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Erro ao atualizar contato existente',
              details: updateError.message
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
        
        console.log('✅ Contato atualizado via webhook:', {
          id: updatedContact.id,
          name: updatedContact.name,
          email: updatedContact.email
        })
        
        return new Response(
          JSON.stringify({
            success: true,
            contactId: updatedContact.id,
            message: 'Contato atualizado com sucesso',
            updated: true,
            data: {
              name: updatedContact.name,
              email: updatedContact.email
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }
    // Get lists to find target list
    const { data: lists } = await supabaseClient
      .from('lists')
      .select('*')
    
    let targetList = null
    
    if (cleanUUID(contactData.listId)) {
      targetList = lists?.find(l => l.id === cleanUUID(contactData.listId))
    }
    
    if (!targetList && lists && lists.length > 0) {
      targetList = lists[0] // Default to first list
    }

    if (!targetList) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhuma lista encontrada'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get pipeline stages
    const { data: stages } = await supabaseClient
      .from('pipeline_stages')
      .select('*')
      .order('order')
    
    const defaultStage = contactData.stageId 
      ? stages?.find(s => s.id === cleanUUID(contactData.stageId))
      : stages?.[0]

    if (!defaultStage) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhuma etapa encontrada'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get agents for distribution
    const { data: agents } = await supabaseClient
      .from('agents')
      .select('*')
      .eq('is_active', true)

    // Get existing contacts for distribution calculation
    const { data: existingContacts } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('list_id', targetList.id)

    // Calculate agent distribution
    let assignedAgentId = cleanUUID(contactData.assignedAgentId)
    
    if (!assignedAgentId && agents && agents.length > 0) {
      const distributionRules = targetList.distribution_rules || []
      const agentsWithRules = distributionRules.filter((rule: any) => 
        agents.some(agent => agent.id === rule.agentId)
      )

      if (agentsWithRules.length > 0) {
        // Use distribution rules
        const totalPercentage = agentsWithRules.reduce((sum: number, rule: any) => sum + rule.percentage, 0)
        
        if (totalPercentage > 0) {
          const agentCounts: Record<string, number> = {}
          agentsWithRules.forEach((rule: any) => {
            agentCounts[rule.agentId] = existingContacts?.filter(c => c.assigned_agent_id === rule.agentId).length || 0
          })

          const totalContactsInList = (existingContacts?.length || 0) + 1
          let selectedAgentId = agentsWithRules[0].agentId
          let lowestRatio = Infinity

          for (const rule of agentsWithRules) {
            const currentCount = agentCounts[rule.agentId] || 0
            const expectedCount = Math.floor((totalContactsInList * rule.percentage) / totalPercentage) || 1
            const ratio = currentCount / expectedCount
            
            if (ratio < lowestRatio) {
              lowestRatio = ratio
              selectedAgentId = rule.agentId
            }
          }
          
          assignedAgentId = selectedAgentId
        }
      } else {
        // Equal distribution
        const agentIndex = (existingContacts?.length || 0) % agents.length
        assignedAgentId = agents[agentIndex].id
      }
    }

    // Create contact in Supabase
    const { data: newContact, error } = await supabaseClient
      .from('contacts')
      .insert({
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone || '',
        company: contactData.company || '',
        instagram: contactData.instagram || '',
        list_id: cleanUUID(targetList.id),
        stage_id: cleanUUID(defaultStage.id),
        assigned_agent_id: assignedAgentId,
        tags: Array.isArray(contactData.tags) ? contactData.tags : [],
        custom_fields: contactData.customFields || {},
        source: contactData.source || 'Webhook',
        notes: contactData.notes || ''
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Erro ao criar contato:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao criar contato',
          details: error.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Contato criado via webhook:', {
      id: newContact.id,
      name: newContact.name,
      email: newContact.email,
      list: targetList.name,
      agent: assignedAgentId
    })

    return new Response(
      JSON.stringify({
        success: true,
        contactId: newContact.id,
        message: 'Contato criado com sucesso',
        data: {
          name: newContact.name,
          email: newContact.email,
          list: targetList.name,
          stage: defaultStage.name,
          assignedAgent: assignedAgentId
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Erro no webhook:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})