import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { webhook_url, webhook_headers, payload } = await req.json();

    if (!webhook_url || !payload) {
      console.error('❌ Parâmetros obrigatórios ausentes:', { webhook_url, payload });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'webhook_url and payload are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🚀 Processando webhook de saída...');
    console.log('🎯 URL de destino:', webhook_url);
    console.log('📦 Payload completo:', JSON.stringify(payload, null, 2));

    // Preparar headers para o webhook
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'CRM-B42-Webhook/1.0',
      'X-Webhook-Source': 'CRM-B42',
      'X-Event-Type': payload.event || 'unknown',
      'X-Timestamp': new Date().toISOString(),
      ...webhook_headers
    };

    console.log('📋 Headers preparados:', headers);

    // Enviar webhook para o sistema externo
    const startTime = Date.now();
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (textError) {
      console.warn('⚠️ Erro ao ler resposta como texto:', textError);
      responseText = 'Erro ao ler resposta';
    }
    
    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      response: responseText,
      webhook_url: webhook_url,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    };

    if (response.ok) {
      console.log('✅ Webhook enviado com sucesso:', {
        url: webhook_url,
        status: response.status,
        responseTime: `${responseTime}ms`,
        event: payload.event,
        contact: payload.contact?.email
      });
    } else {
      console.error('❌ Webhook falhou:', {
        url: webhook_url,
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        event: payload.event,
        contact: payload.contact?.email
      });
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Erro crítico ao processar webhook:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Erro interno ao processar webhook de saída',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});