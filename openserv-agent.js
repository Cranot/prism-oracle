// OpenServ Integration for Prism Oracle
// Registers as a discoverable capability so other agents can hire us

import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

export function createOpenServAgent() {
  if (!process.env.OPENSERV_API_KEY) {
    console.log('OpenServ: DISABLED (no OPENSERV_API_KEY). Set it to enable agent discovery.');
    return null;
  }

  const agent = new Agent({
    systemPrompt: `You are Prism Oracle, an autonomous structural code analysis agent.
You use cognitive prisms to find conservation laws, structural bugs, and hidden assumptions
that vanilla LLMs miss. You achieve Opus-level depth at Haiku costs.

When asked to analyze code, use the analyze_code capability.
When asked about your capabilities, explain that you find:
- Conservation laws (fundamental trade-offs in the code)
- Structural bugs (not just syntax errors)
- Concealment mechanisms (what the code hides)
- Meta-laws (patterns in the patterns)

You charge $1.00 USDC per analysis via x402 on Base.`,
    apiKey: process.env.OPENSERV_API_KEY
  });

  // Core capability: analyze code
  agent.addCapability({
    name: 'analyze_code',
    description: 'Deep structural analysis of source code using cognitive prisms. Finds conservation laws, structural bugs, hidden assumptions, and concealment mechanisms that vanilla LLMs miss. Achieves 9.8/10 depth using Haiku 4.5 at 1/50th the cost of Opus vanilla.',
    inputSchema: z.object({
      code: z.string().describe('Source code to analyze (any language)'),
      mode: z.enum(['l12', 'sdl', 'adaptive', 'full']).optional().describe('Analysis mode: l12 (default, meta-conservation), sdl (deep scan), adaptive (auto-escalate), full (9-pass)')
    }),
    async run({ args }) {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: args.code,
          mode: args.mode || 'l12'
        })
      });

      const result = await response.json();

      if (result.error) {
        return `Analysis failed: ${result.error}`;
      }

      // Format response for the calling agent
      let report = `## Prism Oracle Analysis\n\n`;
      report += `**Depth Score:** ${result.depth_score}/10\n`;
      report += `**Confidence:** ${result.extraction_confidence}\n`;
      report += `**Cost:** $${result.cost_usd}\n\n`;

      if (result.conservation_law) {
        report += `### Conservation Law\n${result.conservation_law}\n\n`;
      }
      if (result.meta_law) {
        report += `### Meta-Law\n${result.meta_law}\n\n`;
      }
      if (result.bugs_found > 0) {
        report += `### Bugs Found (${result.bugs_found})\n`;
        result.bugs.forEach(b => {
          report += `- **[${b.type}]** ${b.location}: ${b.description}\n`;
        });
      }

      report += `\n*Report: ${API_BASE}${result.report_url}*`;

      return report;
    }
  });

  return agent;
}

// Standalone mode — run as separate OpenServ agent process
if (process.argv[1]?.endsWith('openserv-agent.js')) {
  const agent = createOpenServAgent();
  if (agent) {
    agent.start();
    console.log('OpenServ agent running. Discoverable by other agents.');
  }
}
