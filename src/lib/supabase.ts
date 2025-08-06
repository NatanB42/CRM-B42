import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-my-custom-header': 'crm-system'
    }
  }
});

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('agents').select('count').limit(1);
    if (error) {
      console.error('❌ Erro de conexão com Supabase:', error);
      throw new Error(`Falha na conexão com Supabase: ${error.message}`);
    }
    console.log('✅ Conexão com Supabase estabelecida');
    return true;
  } catch (error) {
    console.error('❌ Erro ao testar conexão:', error);
    throw error;
  }
};

// Database types
export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          role: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      lists: {
        Row: {
          id: string;
          name: string;
          description: string;
          color: string;
          distribution_rules: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          color?: string;
          distribution_rules?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          color?: string;
          distribution_rules?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      pipeline_stages: {
        Row: {
          id: string;
          name: string;
          color: string;
          order: number;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          order: number;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          order?: number;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          color: string;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      custom_fields: {
        Row: {
          id: string;
          name: string;
          type: string;
          required: boolean;
          options: any;
          placeholder: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          required?: boolean;
          options?: any;
          placeholder?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          required?: boolean;
          options?: any;
          placeholder?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          company: string;
          instagram: string;
          list_id: string | null;
          stage_id: string | null;
          assigned_agent_id: string | null;
          tags: string[];
          custom_fields: any;
          source: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string;
          company?: string;
          instagram?: string;
          list_id?: string | null;
          stage_id?: string | null;
          assigned_agent_id?: string | null;
          tags?: string[];
          custom_fields?: any;
          source?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
          company?: string;
          instagram?: string;
          list_id?: string | null;
          stage_id?: string | null;
          assigned_agent_id?: string | null;
          tags?: string[];
          custom_fields?: any;
          source?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      folders: {
        Row: {
          id: string;
          name: string;
          color: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      folder_lists: {
        Row: {
          id: string;
          folder_id: string;
          list_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          folder_id: string;
          list_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          folder_id?: string;
          list_id?: string;
          created_at?: string;
        };
      };
      dashboard_configs: {
        Row: {
          id: string;
          user_id: string;
          included_stages_for_total: string[];
          included_stages_for_conversion: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          included_stages_for_total?: string[];
          included_stages_for_conversion?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          included_stages_for_total?: string[];
          included_stages_for_conversion?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      lead_master: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          current_name: string;
          first_phone: string | null;
          current_phone: string | null;
          first_company: string | null;
          current_company: string | null;
          first_source: string | null;
          current_source: string | null;
          is_active: boolean;
          total_interactions: number;
          first_created_at: string;
          last_updated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          current_name: string;
          first_phone?: string | null;
          current_phone?: string | null;
          first_company?: string | null;
          current_company?: string | null;
          first_source?: string | null;
          current_source?: string | null;
          is_active?: boolean;
          total_interactions?: number;
          first_created_at: string;
          last_updated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          current_name?: string;
          first_phone?: string | null;
          current_phone?: string | null;
          first_company?: string | null;
          current_company?: string | null;
          first_source?: string | null;
          current_source?: string | null;
          is_active?: boolean;
          total_interactions?: number;
          first_created_at?: string;
          last_updated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      lead_history: {
        Row: {
          id: string;
          lead_master_id: string;
          contact_id: string | null;
          action_type: string;
          field_name: string | null;
          old_value: string | null;
          new_value: string | null;
          list_id: string | null;
          list_name: string | null;
          stage_id: string | null;
          stage_name: string | null;
          agent_id: string | null;
          agent_name: string | null;
          tags: string[] | null;
          tag_names: string[] | null;
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_master_id: string;
          contact_id?: string | null;
          action_type: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          list_id?: string | null;
          list_name?: string | null;
          stage_id?: string | null;
          stage_name?: string | null;
          agent_id?: string | null;
          agent_name?: string | null;
          tags?: string[] | null;
          tag_names?: string[] | null;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_master_id?: string;
          contact_id?: string | null;
          action_type?: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          list_id?: string | null;
          list_name?: string | null;
          stage_id?: string | null;
          stage_name?: string | null;
          agent_id?: string | null;
          agent_name?: string | null;
          tags?: string[] | null;
          tag_names?: string[] | null;
          metadata?: any;
          created_at?: string;
        };
      };
    };
  };
}