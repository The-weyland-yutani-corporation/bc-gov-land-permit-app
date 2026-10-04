import { apiContract } from '@permit-readiness/contracts';
import { initClient } from '@ts-rest/core';

export function createPermitReadinessClient(baseUrl = '') {
  return initClient(apiContract, {
    baseUrl,
    baseHeaders: {},
    credentials: 'same-origin',
  });
}
