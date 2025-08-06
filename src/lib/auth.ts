import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: User | null;
  error: string | null;
}

// Login function using public.users table
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      return {
        user: null,
        error: 'Email ou senha incorretos'
      };
    }

    // Store user in localStorage for session management
    localStorage.setItem('crm_user', JSON.stringify({
      id: data.id,
      email: data.email,
      name: data.name
    }));

    return {
      user: {
        id: data.id,
        email: data.email,
        name: data.name
      },
      error: null
    };
  } catch (error) {
    return {
      user: null,
      error: 'Erro ao fazer login'
    };
  }
};

// Register function
export const register = async (email: string, name: string, password: string): Promise<AuthResponse> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        name,
        password
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return {
          user: null,
          error: 'Este email já está em uso'
        };
      }
      return {
        user: null,
        error: 'Erro ao criar conta'
      };
    }

    // Store user in localStorage
    localStorage.setItem('crm_user', JSON.stringify({
      id: data.id,
      email: data.email,
      name: data.name
    }));

    return {
      user: {
        id: data.id,
        email: data.email,
        name: data.name
      },
      error: null
    };
  } catch (error) {
    return {
      user: null,
      error: 'Erro ao criar conta'
    };
  }
};

// Logout function
export const logout = (): void => {
  localStorage.removeItem('crm_user');
};

// Get current user from localStorage
export const getCurrentUser = (): User | null => {
  try {
    const userStr = localStorage.getItem('crm_user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};