const baseUrl = process.argv[2];
if (!baseUrl) {
  throw new Error('Usage: node scripts/ci/check-health.mjs <base-url>');
}

for (const path of ['/api/v1/health/live', '/api/v1/health/ready']) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(new URL(path, baseUrl));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 8)
        await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  if (lastError) throw new Error(`${path} failed: ${lastError.message}`);
}

console.log('Web liveness and readiness checks passed.');
