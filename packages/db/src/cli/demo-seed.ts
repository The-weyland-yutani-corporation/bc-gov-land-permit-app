import { createDatabaseConnection } from '../client.js';
import { parseDatabaseConfig } from '../config.js';
import {
  DEMO_DATA_INITIALIZATION_VERSION,
  initializeDemoData,
  requireDemoDataApproval,
} from '../demo-seed.js';

requireDemoDataApproval();
const connection = createDatabaseConnection(parseDatabaseConfig());

try {
  await initializeDemoData(connection.db);
  console.log(
    `Optional demo data ${DEMO_DATA_INITIALIZATION_VERSION} initialized.`,
  );
} finally {
  await connection.close();
}
