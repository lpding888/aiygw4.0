/**
 * 初始化 AI Architect 动态提示词
 * 将硬编码的提示词迁移到数据库，支持动态更新
 */

const SYSTEM_PROMPT = `You are the "AI Architect", an expert system capable of orchestrating complex AI pipelines.
Your goal is to translate user natural language requirements into a valid JSON pipeline definition following the Strict V1 Protocol.

### The Protocol (V1)
The pipeline is a DAG (Directed Acyclic Graph) of nodes.
- **Nodes**: Objects with \`id\` (UUID), \`label\` (string), \`type\` (enum), \`position\` (x, y), \`data\` (config).
- **Edges**: Connections between \`source\` node and \`target\` node.
- **Bindings**: Data flow between nodes (e.g., passing output of Node A to input of Node B).

{{NODE_TYPE_DOCUMENTATION}}

### Binding Syntax (CRITICAL)
To use data from a previous node, use the \`bindings\` object in the target node.
Format: \`{ "target_field_name": { "sourceNode": "node_id", "sourceOutput": "output_field_name" } }\`
Example: To use the 'text' output of 'node_1' as the 'prompt' for 'node_2':
\`\`\`json
{
  "id": "node_2",
  "type": "image_gen",
  "data": { ... },
  "bindings": {
    "prompt": { "sourceNode": "node_1", "sourceOutput": "text" }
  }
}
\`\`\`

### CRITICAL Rules
1. Each node MUST have: \`id\` (UUID), \`label\` (string), \`type\` (enum), \`position\` ({x, y}), \`data\` (object)
2. Entry nodes (nodes with no incoming edges) will be automatically detected
3. Exit nodes (nodes with no outgoing edges) will be automatically detected
4. NO cycles allowed - the graph must be a DAG
5. All referenced node IDs in bindings must exist in the nodes array

### Output Format
Return ONLY a valid JSON object wrapped in \`\`\`json markdown block.
Structure:
\`\`\`json
{
  "version": "1.0",
  "meta": {
    "name": "Pipeline Name",
    "description": "Brief description"
  },
  "nodes": [ ... ],
  "edges": [ ... ]
}
\`\`\``;

const FEW_SHOT_EXAMPLES = `
### Example 1: Image Generation + Description
User: "Generate a cat image and describe it in a poem."

\`\`\`json
{
  "version": "1.0",
  "meta": {
    "name": "Cat Poem Generator",
    "description": "Generates a cat image and creates a poem describing it"
  },
  "nodes": [
    {
      "id": "a1b2c3d4-1111-1111-1111-111111111111",
      "label": "Generate Cat Image",
      "type": "image_gen",
      "position": { "x": 250, "y": 100 },
      "data": {
        "model": "flux-schnell",
        "prompt": "A cute fluffy cat with big eyes, cinematic lighting, highly detailed",
        "aspect_ratio": "1:1"
      }
    },
    {
      "id": "a1b2c3d4-2222-2222-2222-222222222222",
      "label": "Write Poem",
      "type": "llm",
      "position": { "x": 250, "y": 300 },
      "data": {
        "model": "gpt-4",
        "system_prompt": "You are a talented poet who writes beautiful verses about images.",
        "prompt": "Write a short poem about this image.",
        "temperature": 0.8
      },
      "bindings": {
        "prompt": {
          "sourceNode": "a1b2c3d4-1111-1111-1111-111111111111",
          "sourceOutput": "images"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "a1b2c3d4-1111-1111-1111-111111111111",
      "target": "a1b2c3d4-2222-2222-2222-222222222222"
    }
  ]
}
\`\`\`

### Example 2: Text Processing Chain
User: "Translate Chinese to English, then summarize."

\`\`\`json
{
  "version": "1.0",
  "meta": {
    "name": "Translate and Summarize",
    "description": "Translates Chinese text to English and then creates a summary"
  },
  "nodes": [
    {
      "id": "b1b2c3d4-1111-1111-1111-111111111111",
      "label": "Translate to English",
      "type": "llm",
      "position": { "x": 250, "y": 100 },
      "data": {
        "model": "gpt-4",
        "prompt": "Translate the following Chinese text to English: {input_text}",
        "temperature": 0.3
      }
    },
    {
      "id": "b1b2c3d4-2222-2222-2222-222222222222",
      "label": "Summarize",
      "type": "llm",
      "position": { "x": 250, "y": 300 },
      "data": {
        "model": "gpt-3.5-turbo",
        "prompt": "Summarize this text in 2-3 sentences.",
        "temperature": 0.5
      },
      "bindings": {
        "prompt": {
          "sourceNode": "b1b2c3d4-1111-1111-1111-111111111111",
          "sourceOutput": "text"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "b1b2c3d4-1111-1111-1111-111111111111",
      "target": "b1b2c3d4-2222-2222-2222-222222222222"
    }
  ]
}
\`\`\`
`;

const MODIFY_PROMPT = `You are modifying an EXISTING pipeline.
Input:
1. **Current Pipeline JSON**: The current state.
2. **Modification Request**: What the user wants to change.

Output:
Return the **FULL** updated Pipeline JSON.
Preserve existing nodes/edges unless strictly necessary to change them.`;

const ERROR_FEEDBACK_TEMPLATE = `Your previous JSON was invalid.

Error: {{ERROR_MESSAGE}}

Please fix the JSON and return ONLY the valid JSON wrapped in \`\`\`json code block.
Remember:
- All node IDs must be valid UUIDs
- Only use node types: {{SUPPORTED_NODE_TYPES}}
- No cycles allowed
- All binding references must point to existing nodes`;

exports.up = async function (knex) {
    // 检查 prompt_templates 表是否存在
    const exists = await knex.schema.hasTable('prompt_templates');
    if (!exists) {
        throw new Error('prompt_templates table does not exist. Please run migration 20241204000003 first.');
    }

    // 插入 AI Architect 提示词模板
    const now = new Date();

    await knex('prompt_templates').insert([
        {
            id: knex.raw('(UUID())'),
            key: 'ai_architect_system',
            name: 'AI Architect - System Prompt',
            description: 'Main system prompt for AI Architect pipeline generation. Supports {{NODE_TYPE_DOCUMENTATION}} variable for dynamic node type injection.',
            content: SYSTEM_PROMPT,
            category: 'system',
            variables: JSON.stringify({
                NODE_TYPE_DOCUMENTATION: {
                    type: 'string',
                    description: 'Auto-generated documentation of available node types from Protocol',
                    required: true,
                    source: 'protocolAnalyzer.generateNodeTypeDocumentation()'
                }
            }),
            metadata: JSON.stringify({
                usage: 'pipeline_generation',
                supports_dynamic_nodes: true,
                auto_updated: true,
                last_protocol_sync: now.toISOString()
            }),
            version: 1,
            status: 'published',
            created_at: now,
            updated_at: now
        },
        {
            id: knex.raw('(UUID())'),
            key: 'ai_architect_few_shot',
            name: 'AI Architect - Few-Shot Examples',
            description: 'Few-shot examples to teach LLM correct pipeline structure',
            content: FEW_SHOT_EXAMPLES,
            category: 'assistant',
            variables: JSON.stringify({}),
            metadata: JSON.stringify({
                usage: 'pipeline_generation',
                example_count: 2,
                example_types: ['image_generation_with_llm', 'text_processing_chain']
            }),
            version: 1,
            status: 'published',
            created_at: now,
            updated_at: now
        },
        {
            id: knex.raw('(UUID())'),
            key: 'ai_architect_modify',
            name: 'AI Architect - Modify Prompt',
            description: 'Prompt template for modifying existing pipelines',
            content: MODIFY_PROMPT,
            category: 'system',
            variables: JSON.stringify({}),
            metadata: JSON.stringify({
                usage: 'pipeline_modification'
            }),
            version: 1,
            status: 'published',
            created_at: now,
            updated_at: now
        },
        {
            id: knex.raw('(UUID())'),
            key: 'ai_architect_error_feedback',
            name: 'AI Architect - Error Feedback',
            description: 'Template for providing error feedback during auto-fix loop. Supports {{ERROR_MESSAGE}} and {{SUPPORTED_NODE_TYPES}} variables.',
            content: ERROR_FEEDBACK_TEMPLATE,
            category: 'user',
            variables: JSON.stringify({
                ERROR_MESSAGE: {
                    type: 'string',
                    description: 'The error message from validation',
                    required: true
                },
                SUPPORTED_NODE_TYPES: {
                    type: 'string',
                    description: 'Comma-separated list of supported node types',
                    required: true,
                    source: 'protocolAnalyzer.getSupportedNodeTypes().join(", ")'
                }
            }),
            metadata: JSON.stringify({
                usage: 'auto_fix_loop',
                supports_dynamic_nodes: true
            }),
            version: 1,
            status: 'published',
            created_at: now,
            updated_at: now
        }
    ]);

    console.log('✅ AI Architect prompts initialized successfully');
};

exports.down = async function (knex) {
    // 删除 AI Architect 相关的提示词
    await knex('prompt_templates')
        .whereIn('key', [
            'ai_architect_system',
            'ai_architect_few_shot',
            'ai_architect_modify',
            'ai_architect_error_feedback'
        ])
        .delete();

    console.log('✅ AI Architect prompts removed');
};
