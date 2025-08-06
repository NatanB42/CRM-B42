import { Agent, Contact, List, DistributionRule } from '../types';

export const distributeContactToAgent = (
  contact: Contact,
  agents: Agent[],
  existingContacts: Contact[],
  list: List
): string | undefined => {
  const activeAgents = agents.filter(agent => agent.isActive);
  
  if (activeAgents.length === 0) {
    return undefined;
  }

  // Get distribution rules for this specific list
  const listRules = list.distributionRules || [];
  const agentsWithRules = listRules.filter(rule => 
    activeAgents.some(agent => agent.id === rule.agentId)
  );

  if (agentsWithRules.length === 0) {
    // If no rules defined, distribute equally among active agents
    const contactsInList = existingContacts.filter(c => c.listId === list.id);
    const agentIndex = contactsInList.length % activeAgents.length;
    return activeAgents[agentIndex].id;
  }

  // Calculate total percentage for this list
  const totalPercentage = agentsWithRules.reduce((sum, rule) => sum + rule.percentage, 0);
  
  if (totalPercentage === 0) {
    return activeAgents[0].id;
  }

  // Count existing contacts per agent in this specific list
  const contactsInList = existingContacts.filter(c => c.listId === list.id);
  const agentCounts = agentsWithRules.reduce((acc, rule) => {
    acc[rule.agentId] = contactsInList.filter(c => c.assignedAgentId === rule.agentId).length;
    return acc;
  }, {} as Record<string, number>);

  // Calculate expected distribution for this list
  const totalContactsInList = contactsInList.length + 1; // Including the new contact
  const expectedCounts = agentsWithRules.reduce((acc, rule) => {
    acc[rule.agentId] = Math.floor((totalContactsInList * rule.percentage) / totalPercentage);
    return acc;
  }, {} as Record<string, number>);

  // Find agent with lowest actual vs expected ratio
  let selectedAgentId = agentsWithRules[0].agentId;
  let lowestRatio = Infinity;

  for (const rule of agentsWithRules) {
    const currentCount = agentCounts[rule.agentId] || 0;
    const expectedCount = expectedCounts[rule.agentId] || 1;
    const ratio = currentCount / expectedCount;
    
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      selectedAgentId = rule.agentId;
    }
  }

  return selectedAgentId;
};