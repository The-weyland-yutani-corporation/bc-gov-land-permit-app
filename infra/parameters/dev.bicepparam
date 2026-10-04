using '../main.bicep'

param environmentName = 'permit-readiness-dev'
param environmentProfile = 'dev'
param location = 'canadacentral'
param postgresAdminPassword = readEnvironmentVariable('AZURE_POSTGRES_ADMIN_PASSWORD')
param authSessionSecret = readEnvironmentVariable('AUTH_SESSION_SECRET')
param enableSyntheticAuth = readEnvironmentVariable('ENABLE_SYNTHETIC_AUTH')
param aiProjectDeployments = '[{"name":"gpt-5-mini","model":{"format":"OpenAI","name":"gpt-5-mini"},"sku":{"name":"GlobalStandard","capacity":10}}]'
param webContainerAppMode = readEnvironmentVariable('WEB_CONTAINER_APP_MODE')
param webContainerImage = readEnvironmentVariable('WEB_CONTAINER_IMAGE', '')
param agentEndpoint = readEnvironmentVariable('AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT', '')
param logRetentionDays = 30
param containerAppMinReplicas = 0
param containerAppMaxReplicas = 2
param webCpu = '0.5'
param webMemory = '1Gi'
param postgresSkuName = 'Standard_B1ms'
param postgresSkuTier = 'Burstable'
param postgresStorageGb = 32
param postgresBackupRetentionDays = 7
param searchSku = 'basic'
param searchReplicaCount = 1
param searchSemanticTier = 'free'
param registrySku = 'Basic'
param storageSku = 'Standard_LRS'
param keyVaultRetentionDays = 7
param keyVaultPurgeProtection = false
