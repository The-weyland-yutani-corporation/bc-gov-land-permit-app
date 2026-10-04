import { loadConfiguration } from './config.js';
import { createConfiguredGuidanceSearch } from './guidance-search.js';
import { createAzureModelClient } from './model.js';
import { PermitReadinessOrchestrator } from './orchestrator.js';
import { createAgentServer } from './server.js';
import { createLogger } from './telemetry.js';

export * from './config.js';
export * from './errors.js';
export * from './guidance-search.js';
export * from './instructions.js';
export * from './model.js';
export * from './orchestrator.js';
export * from './protocol.js';
export * from './server.js';
export * from './tools.js';

export const workspaceBoundary = '@permit-readiness/agent';

if (process.argv[1] && /dist[\\/]index\.js$/i.test(process.argv[1])) {
  const configuration = loadConfiguration();
  const log = createLogger(configuration.LOG_LEVEL);
  const orchestrator = new PermitReadinessOrchestrator(
    configuration,
    createAzureModelClient(configuration),
    await createConfiguredGuidanceSearch(configuration),
  );
  const server = createAgentServer({ configuration, orchestrator });
  server.listen(configuration.PORT, '0.0.0.0', () => {
    log('info', 'agent_server_started', {
      port: configuration.PORT,
      protocol: 'responses',
      protocolVersion: '2.0.0',
      agentName: configuration.FOUNDRY_AGENT_NAME,
      agentVersion: configuration.FOUNDRY_AGENT_VERSION,
    });
  });
  const shutdown = (signal: NodeJS.Signals) => {
    log('info', 'agent_server_stopping', { signal });
    server.close((error) => {
      if (error) {
        log('error', 'agent_server_stop_failed', { message: error.message });
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
