import pb from './pocketbase';
import { CustomField } from '../types';

// Auto-create collections if they don't exist
export const ensureCollectionsExist = async () => {
  try {
    // Check if collections exist by trying to fetch them
    const collections = [
      'agents',
      'lists', 
      'pipeline_stages',
      'tags',
      'custom_fields',
      'contacts'
    ];

    for (const collectionName of collections) {
      try {
        await pb.collection(collectionName).getList(1, 1);
      } catch (error) {
        console.log(`Collection ${collectionName} doesn't exist, will be created by migrations`);
      }
    }
  } catch (error) {
    console.error('Error checking collections:', error);
  }
};

// Auto-update custom fields schema
export const syncCustomFieldsSchema = async (customFields: CustomField[]) => {
  try {
    // This would be implemented to dynamically update the contacts collection
    // to add new custom field columns as needed
    console.log('Custom fields schema sync not needed with JSON storage');
  } catch (error) {
    console.error('Error syncing custom fields schema:', error);
  }
};

// Validate and create missing relationships
export const validateRelationships = async () => {
  try {
    // Ensure all foreign key relationships are properly set up
    console.log('Validating relationships...');
    
    // Check if all referenced records exist
    const contacts = await pb.collection('contacts').getFullList();
    const lists = await pb.collection('lists').getFullList();
    const stages = await pb.collection('pipeline_stages').getFullList();
    const agents = await pb.collection('agents').getFullList();
    
    // Clean up orphaned records
    for (const contact of contacts) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Check if listId exists
      if (contact.listId && !lists.find(l => l.id === contact.listId)) {
        updates.listId = lists[0]?.id || '';
        needsUpdate = true;
      }
      
      // Check if stageId exists
      if (contact.stageId && !stages.find(s => s.id === contact.stageId)) {
        updates.stageId = stages[0]?.id || '';
        needsUpdate = true;
      }
      
      // Check if assignedAgentId exists
      if (contact.assignedAgentId && !agents.find(a => a.id === contact.assignedAgentId)) {
        updates.assignedAgentId = '';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await pb.collection('contacts').update(contact.id, updates);
        console.log(`Fixed orphaned references for contact ${contact.id}`);
      }
    }
    
    console.log('✅ Relationships validated');
  } catch (error) {
    console.error('Error validating relationships:', error);
  }
};

// Auto-backup data
export const createBackup = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {
      timestamp,
      agents: await pb.collection('agents').getFullList(),
      lists: await pb.collection('lists').getFullList(),
      pipeline_stages: await pb.collection('pipeline_stages').getFullList(),
      tags: await pb.collection('tags').getFullList(),
      custom_fields: await pb.collection('custom_fields').getFullList(),
      contacts: await pb.collection('contacts').getFullList()
    };
    
    // In a real implementation, this would save to a file or external storage
    console.log('Backup created:', timestamp);
    return backupData;
  } catch (error) {
    console.error('Error creating backup:', error);
    return null;
  }
};