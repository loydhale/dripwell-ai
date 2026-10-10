import { defineAgent, defineDynamic } from 'eve';
import { AI_MODEL, assertAIReady } from '../lib/ai';

export default defineAgent({
  model: defineDynamic({
    events: {
      'session.started': () => {
        assertAIReady();
        return AI_MODEL;
      },
    },
  }),
  defaultTools: false,
  build: { externalDependencies: ['@prisma/client'] },
  limits: {
    maxInputTokensPerSession: 200000,
    maxOutputTokensPerSession: 20000,
    maxTokenCostUsdPerSession: 2,
    sessionTimeoutMs: 14 * 24 * 60 * 60 * 1000,
  },
});
