import { Contact, CRMData } from '../types';

export const exportContactsToCSV = (
  contacts: Contact[],
  data: CRMData,
  filename: string = 'contatos-exportados'
) => {
  // Define headers
  const headers = [
    'Nome',
    'Email', 
    'Telefone',
    'Empresa',
    'Lista',
    'Etapa',
    'Atendente',
    'Tags',
    'Fonte',
    'Observações',
    'Instagram',
    'Data de Criação',
    'Data de Atualização'
  ];

  // Add custom field headers
  const customFieldHeaders = data.customFields.map(field => field.name);
  headers.push(...customFieldHeaders);

  // Convert contacts to CSV rows
  const rows = contacts.map(contact => {
    const list = data.lists.find(l => l.id === contact.listId);
    const stage = data.pipelineStages.find(s => s.id === contact.stageId);
    const agent = data.agents.find(a => a.id === contact.assignedAgentId);
    const tags = contact.tags
      .map(tagId => data.tags.find(t => t.id === tagId)?.name)
      .filter(Boolean)
      .join('; ');

    const row = [
      contact.name,
      contact.email,
      contact.phone || '',
      contact.company || '',
      list?.name || '',
      stage?.name || '',
      agent?.name || '',
      tags,
      contact.source || '',
      contact.notes || '',
      contact.instagram || '',
      contact.createdAt.toLocaleDateString('pt-BR'),
      contact.updatedAt.toLocaleDateString('pt-BR')
    ];

    // Add custom field values
    data.customFields.forEach(field => {
      const value = contact.customFields[field.id] || '';
      row.push(String(value));
    });

    return row;
  });

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // Create and download file
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};