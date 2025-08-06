import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtime = (onDataChange: () => void) => {
  useEffect(() => {
    if (!onDataChange) return;
    
    console.log('🔄 Configurando subscriptions em tempo real...');
    
    // ✅ CORREÇÃO: Debounce mais inteligente para evitar conflitos com movimentos otimistas
    let updateTimeout: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        console.log('📡 Executando atualização via realtime...');
        onDataChange();
      }, 1000); // Reduzido para 1 segundo para melhor responsividade
    };
    
    // Subscribe to contacts changes
    const contactsSubscription = supabase
      .channel('contacts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'contacts' }, 
        (payload) => {
          console.log('📡 Realtime: Mudança detectada:', payload.eventType, payload.new?.name || payload.old?.name);
          
          // Para mudanças de etapa, aguardar um pouco mais
          if (payload.eventType === 'UPDATE' && payload.old && payload.new) {
            const stageChanged = payload.old.stage_id !== payload.new.stage_id;
            if (stageChanged) {
              console.log('📡 Realtime: Mudança de etapa detectada, sincronizando...');
              // Delay menor para mudanças de etapa
              clearTimeout(updateTimeout);
              updateTimeout = setTimeout(() => {
                console.log('📡 Realtime: Sincronizando mudança de etapa confirmada...');
                onDataChange();
              }, 1500);
              return;
            }
          }
          
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to lists changes
    const listsSubscription = supabase
      .channel('lists-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'lists' }, 
        (payload) => {
          console.log('📡 Lista atualizada:', payload.eventType);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to agents changes
    const agentsSubscription = supabase
      .channel('agents-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'agents' }, 
        (payload) => {
          console.log('📡 Atendente atualizado:', payload.eventType);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to pipeline_stages changes
    const stagesSubscription = supabase
      .channel('stages-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'pipeline_stages' }, 
        (payload) => {
          console.log('📡 Etapa atualizada:', payload.eventType);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to tags changes
    const tagsSubscription = supabase
      .channel('tags-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tags' }, 
        (payload) => {
          console.log('📡 Tag atualizada:', payload.eventType);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to custom_fields changes
    const fieldsSubscription = supabase
      .channel('fields-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'custom_fields' }, 
        (payload) => {
          console.log('📡 Campo personalizado atualizado:', payload.eventType);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to dashboard_configs changes
    const dashboardSubscription = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'dashboard_configs' }, 
        (payload) => {
          console.log('📡 Dashboard config atualizada:', payload.eventType);
          // ✅ CORREÇÃO: Don't reload all data for dashboard config changes
          // The dashboard will handle its own state updates
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      console.log('🔄 Limpando subscriptions...');
      clearTimeout(updateTimeout);
      contactsSubscription.unsubscribe();
      listsSubscription.unsubscribe();
      agentsSubscription.unsubscribe();
      stagesSubscription.unsubscribe();
      tagsSubscription.unsubscribe();
      fieldsSubscription.unsubscribe();
      dashboardSubscription.unsubscribe();
    };
  }, [onDataChange]);
};