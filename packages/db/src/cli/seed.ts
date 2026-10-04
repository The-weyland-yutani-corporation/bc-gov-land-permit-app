import { createDatabaseConnection } from '../client.js';
import { parseDatabaseConfig } from '../config.js';
import { initializeReferenceData } from '../seed.js';
import { REFERENCE_DATA_INITIALIZATION_VERSION } from '../seed-data.js';

const connection = createDatabaseConnection(parseDatabaseConfig());

try {
  await initializeReferenceData(connection.db);
  console.log(
    `Required reference data ${REFERENCE_DATA_INITIALIZATION_VERSION} initialized (db:seed is a compatibility alias; use db:initialize).`,
  );
} finally {
  await connection.close();
}
