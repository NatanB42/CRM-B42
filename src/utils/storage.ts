import { CRMData } from '../types';

const STORAGE_KEY = 'crm-local-data';

export const saveData = (data: CRMData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
  }
};

export const loadData = (): CRMData | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // Convert date strings back to Date objects
      data.contacts = data.contacts.map((contact: any) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        updatedAt: new Date(contact.updatedAt)
      }));
      return data;
    }
    return null;
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    return null;
  }
};

export const clearData = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};