import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contact_id, list_id, agent_id } = await req.json();

    if (!contact_id || !list_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id and list_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contact details
    const { data: contact, error: contactError } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('Error fetching contact:', contactError?.message || 'Contact not found');
      return new Response(
        JSON.stringify({ error: 'Contact not found or error fetching contact details' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch list details to get webhook configurations
    const { data: list, error: listError } = await supabaseClient
      .from('lists')
      .select('name, outgoing_webhooks')
      .eq('id', list_id)
      .single();

    if (listError || !list) {
      console.error('Error fetching list:', listError?.message || 'List not found');
      return new Response(
        JSON.stringify({ error: 'List not found or error fetching list details' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch agent details if assigned
    let agent = null;
    if (agent_id) {
      const { data: agentData, error: agentError } = await supabaseClient
        .from('agents')
        .select('id, name, email, phone, role')
        .eq('id', agent_id)
        .single();
      if (agentError) {
        console.warn('Error fetching agent details:', agentError.message);
      } else {
        agent = agentData;
      }
    }

    const outgoingWebhooks = list.outgoing_webhooks || [];

    if (outgoingWebhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No outgoing webhooks configured for this list' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    for (const webhookConfig of outgoingWebhooks) {
      const webhookUrl = webhookConfig.url;
      const webhookEnabled = webhookConfig.enabled !== false;

      if (!webhookUrl || !webhookEnabled) {
        results.push({ url: webhookUrl, status: 'skipped', reason: 'URL missing or disabled' });
        continue;
      }

      const payload = {
        event: 'contact_added_to_list',
        timestamp: new Date().toISOString(),
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          instagram: contact.instagram,
          source: contact.source,
          notes: contact.notes,
          custom_fields: contact.custom_fields,
          created_at: contact.created_at,
          updated_at: contact.updated_at,
        },
        list: {
          id: list_id,
          name: list.name,
        },
        assigned_agent: agent,
      };

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...webhookConfig.headers,
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        results.push({
          url: webhookUrl,
          status: response.ok ? 'success' : 'failed',
          statusCode: response.status,
          response: responseText,
        });
        
        if (!response.ok) {
          console.error(`Webhook to ${webhookUrl} failed: ${response.status} - ${responseText}`);
        }
      } catch (fetchError) {
        results.push({ url: webhookUrl, status: 'error', error: fetchError.message });
        console.error(`Error sending webhook to ${webhookUrl}:`, fetchError.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook execution error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});