export interface AgentTask {
  id: string;
  type: string;
  payload: any;
}

export interface AgentResult {
  success: boolean;
  data: any;
  stepsTaken: string[];
}

export interface IAgentWorkflowProvider {
  /**
   * Orchestrates an agentic multi-step planning and retrieval workflow.
   */
  executeWorkflow(task: AgentTask): Promise<AgentResult>;
}

export class PlaceholderAgentWorkflowProvider implements IAgentWorkflowProvider {
  async executeWorkflow(_task: AgentTask): Promise<AgentResult> {
    throw new Error('Method not implemented. IAgentWorkflowProvider is a Phase 2 placeholder.');
  }
}
