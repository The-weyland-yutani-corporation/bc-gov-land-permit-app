import { createDatabaseConnection } from '../client.js';
import { parseDatabaseConfig } from '../config.js';
import { initializeReferenceData } from '../seed.js';
import { REFERENCE_DATA_INITIALIZATION_VERSION } from '../seed-data.js';

const connection = createDatabaseConnection(parseDatabaseConfig());

try {
  await initializeReferenceData(connection.db);
  console.log(
    `Required reference data ${REFERENCE_DATA_INITIALIZATION_VERSION} initialized.`,
  );
} finally {
  await connection.close();
}
