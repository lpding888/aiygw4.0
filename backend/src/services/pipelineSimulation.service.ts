import logger from '../utils/logger.js';

// Mock AI Gateway for simulation
const mockAiGateway = {
  chat: async (model: string, messages: { role: string; content: string }[]): Promise<string> => {
    logger.info(`[PipelineSimulation] Mock AI Chat for ${model}: ${JSON.stringify(messages)}`);
    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500));
    const userMessage = messages.find((m) => m.role === 'user')?.content || '';
    if (userMessage.includes('hello') || userMessage.includes('你好')) {
      return 'Mocked response: Hello there! How can I help you with your pipeline simulation?';
    }
    if (userMessage.includes('image description')) {
      return 'Mocked response: This is a sunny beach with a person wearing a red dress. (from Chat Model)';
    }
    return `Mocked AI chat response for model ${model}: Processed "${userMessage.substring(0, Math.min(userMessage.length, 50))}"...`;
  },
  imageGeneration: async (prompt: string, imageUrl?: string): Promise<string> => {
    logger.info(`[PipelineSimulation] Mock Image Gen: Prompt: "${prompt}", Image: "${imageUrl}"`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return 'https://mock-image-gen.com/generated_image_url.png'; // Placeholder image URL
  }
};

/**
 * Helper function to resolve variables from context
 * Supports {{variable_name}} and {{node_id.output.key}}
 */
type SimulationContext = Record<string, any>;

export interface SimulationNode {
  id: string;
  type?: string;
  data: Record<string, any>;
}

export interface SimulationEdge {
  id?: string;
  source: string;
  target: string;
}

export interface SimulationPipeline {
  nodes: SimulationNode[];
  edges: SimulationEdge[];
}

const resolveVariables = (template: string, context: SimulationContext): string => {
  return template.replace(/{{(.*?)}}/g, (match, p1) => {
    const path = p1.trim().split('.');
    let value = context;
    for (const segment of path) {
      if (value === undefined || value === null) return match;
      value = value[segment];
    }
    return value !== undefined && value !== null ? String(value) : match;
  });
};

const setNodeOutput = (context: SimulationContext, nodeId: string, value: unknown): void => {
  context[nodeId] = {
    ...(context[nodeId] ?? {}),
    output: value
  };
  context.last_node = {
    id: nodeId,
    output: value
  };
};

interface SimulationResult {
  nodeId: string;
  nodeType: string;
  status: 'success' | 'failed' | 'skipped';
  input: Record<string, any>;
  output: Record<string, any>;
  error?: string;
  duration: number; // in ms
  timestamp: string;
}

interface SimulationReport {
  results: SimulationResult[];
  finalOutput: unknown;
  overallStatus: 'success' | 'failed';
  message: string;
}

class PipelineSimulationService {
  async simulatePipeline(
    pipeline: SimulationPipeline,
    initialInputs: Record<string, any>
  ): Promise<SimulationReport> {
    const { nodes, edges } = pipeline;
    const results: SimulationResult[] = [];
    const context: SimulationContext = { ...initialInputs }; // Simulation context (variables)

    // Basic topological sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();
    const nodeMap = new Map<string, SimulationNode>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      graph.set(node.id, []);
      nodeMap.set(node.id, node);
    }

    for (const edge of edges) {
      const source = edge.source;
      const target = edge.target;
      if (inDegree.has(target)) {
        inDegree.set(target, inDegree.get(target)! + 1);
      }
      if (graph.has(source)) {
        graph.get(source)!.push(target);
      }
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes in topological order
    let overallStatus: 'success' | 'failed' = 'success';

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId)!;
      const startTime = process.hrtime.bigint();

      let nodeStatus: 'success' | 'failed' | 'skipped' = 'success';
      const nodeOutput: Record<string, any> = {};
      let nodeError: string | undefined;
      const nodeInput: Record<string, any> = {};

      try {
        // Collect inputs for the current node from context
        // This is a simplified input collection. In a real system, you'd map node handles to context variables.
        // For simulation, we'll try to guess inputs based on node type and available context.

        // Example: Provider node (AI model call)
        if (node.type === 'provider') {
          const providerRef = node.data.providerRef || 'default-ai-model';
          const aiTaskType = node.data.ai_task_type || 'chat'; // 'chat' or 'image_generation'

          nodeInput.providerRef = providerRef;
          nodeInput.aiTaskType = aiTaskType;

          if (aiTaskType === 'chat') {
            const promptTemplate = node.data.prompt || 'Tell me about {{initial_text_input}}';
            const finalPrompt = resolveVariables(promptTemplate, context);
            nodeInput.prompt = finalPrompt;

            const aiResponse = await mockAiGateway.chat(providerRef, [
              { role: 'user', content: finalPrompt }
            ]);
            nodeOutput.result = aiResponse;
            setNodeOutput(context, node.id, aiResponse);
          } else if (aiTaskType === 'image_generation') {
            const promptTemplate = node.data.prompt || 'Generate image from {{initial_text_input}}';
            const finalPrompt = resolveVariables(promptTemplate, context);
            const imageUrl = resolveVariables(
              node.data.imageUrl || '{{initial_image_url}}',
              context
            ); // Use image URL from context

            nodeInput.prompt = finalPrompt;
            nodeInput.imageUrl = imageUrl;

            const generatedImageUrl = await mockAiGateway.imageGeneration(finalPrompt, imageUrl);
            nodeOutput.result = generatedImageUrl;
            setNodeOutput(context, node.id, generatedImageUrl);
          }
        } else if (node.type === 'condition') {
          const conditionExpressionTemplate = node.data.condition || 'true';
          const finalConditionExpression = resolveVariables(conditionExpressionTemplate, context);
          nodeInput.conditionExpression = finalConditionExpression;

          // WARNING: Using eval() directly can be a security risk in production.
          // For simulation and dev environment, it's acceptable.
          let conditionResult: boolean;
          try {
            // Create a function to safely evaluate the expression with context
            const evaluateFunction = new Function(
              'context',
              `with (context) { return ${finalConditionExpression}; }`
            );
            conditionResult = !!evaluateFunction(context);
          } catch (e: any) {
            logger.warn(
              `[PipelineSimulation] Failed to evaluate condition "${finalConditionExpression}": ${e.message}`
            );
            conditionResult = false; // Default to false on error
            nodeError = `Condition evaluation failed: ${e.message}`;
            nodeStatus = 'failed';
            overallStatus = 'failed';
          }
          nodeOutput.result = conditionResult;
          setNodeOutput(context, node.id, conditionResult);
        } else if (node.type === 'postProcess') {
          const processor = node.data.processor || 'noop';
          const inputTemplate = node.data.input || '{{last_node.output}}'; // Placeholder for configurable input
          const inputToProcess = resolveVariables(inputTemplate, context);

          nodeInput.processor = processor;
          nodeInput.input = inputToProcess;

          // Mock processing
          let processedResult: unknown = `Processed "${inputToProcess}" with ${processor}`;
          if (processor === 'enhance') {
            processedResult = `Enhanced version of: "${inputToProcess}"`;
          } else if (processor === 'json') {
            try {
              processedResult = JSON.parse(inputToProcess);
            } catch {
              processedResult = { error: 'Invalid JSON', original: inputToProcess };
            }
          }
          nodeOutput.result = processedResult;
          setNodeOutput(context, node.id, processedResult);
        } else if (node.type === 'fork') {
          // Fork nodes simply pass all current context to their outgoing edges
          // In this linear simulation, it's a no-op for explicit processing, just continues the flow.
          nodeOutput.message = 'Context passed to parallel branches.';
          setNodeOutput(context, node.id, { ...context });
        } else if (node.type === 'join') {
          // Join nodes wait for all incoming branches.
          // In this linear simulation, all required inputs from upstream nodes
          // are already in the context. We might aggregate specific results here.
          // For now, it's a passthrough or simple aggregation.
          nodeOutput.message = 'Joined inputs from parallel branches.';
          // Example: Collect outputs from specific upstream nodes if data.collect_outputs is defined
          if (node.data.collect_outputs && Array.isArray(node.data.collect_outputs)) {
            const collected: Record<string, any> = {};
            for (const key of node.data.collect_outputs) {
              collected[key] = context[key];
            }
            nodeOutput.collected = collected;
            setNodeOutput(context, node.id, collected);
          } else {
            setNodeOutput(context, node.id, { ...context });
          }
        } else if (node.type === 'end') {
          const outputKey = node.data.outputKey || 'final_result';
          const finalValue = resolveVariables(
            node.data.returnValue || '{{last_node.output}}',
            context
          ); // Allow configuring what to return
          nodeInput.outputKey = outputKey;
          nodeOutput[outputKey] = finalValue;
          context.final_output = finalValue; // Store final output
          setNodeOutput(context, node.id, finalValue);
        }
        // Add more node types as needed
      } catch (err: any) {
        nodeStatus = 'failed';
        overallStatus = 'failed';
        nodeError = err.message || 'Unknown simulation error';
        logger.error(`[PipelineSimulation] Node ${node.id} (${node.type}) failed: ${nodeError}`);
      }

      const endTime = process.hrtime.bigint();
      results.push({
        nodeId: node.id,
        nodeType: node.type || 'unknown',
        status: nodeStatus,
        input: nodeInput,
        output: nodeOutput,
        error: nodeError,
        duration: Number(endTime - startTime) / 1_000_000, // Convert to ms
        timestamp: new Date().toISOString()
      });

      // Update in-degrees of neighbors
      for (const neighborId of graph.get(nodeId) || []) {
        inDegree.set(neighborId, inDegree.get(neighborId)! - 1);
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      }
    }

    // Determine final output
    const finalOutput = context.final_output ?? {};
    const message =
      overallStatus === 'success'
        ? 'Pipeline simulation completed successfully.'
        : 'Pipeline simulation failed.';

    return {
      results,
      finalOutput,
      overallStatus,
      message
    };
  }
}

const pipelineSimulationService = new PipelineSimulationService();
export default pipelineSimulationService;
