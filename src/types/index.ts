export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  instagram?: string;
  listId: string;
  stageId: string;
  assignedAgentId?: string;
  tags: string[];
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  source?: string;
  notes?: string;
}

export interface List {
  id: string;
  name: string;
  description: string;
  color: string;
  distributionRules: DistributionRule[];
}

export interface DistributionRule {
  agentId: string;
  percentage: number;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  phone?: string;
  role?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  description?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'currency' | 'date' | 'checkbox' | 'instagram';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface CRMData {
  contacts: Contact[];
  lists: List[];
  agents: Agent[];
  pipelineStages: PipelineStage[];
  tags: Tag[];
  customFields: CustomField[];
}

export interface Integration {
  id: string;
  name: string;
  type: 'webhook' | 'api' | 'zapier';
  isActive: boolean;
  config: Record<string, any>;
}

export interface PipelineConfig {
  id: string;
  listId: string;
  userId: string;
  visibleStages: string[];
  stageOrder: string[];
  createdAt: Date;
  updatedAt: Date;
}