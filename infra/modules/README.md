# Bicep modules

| Module                 | Responsibility                                             |
| ---------------------- | ---------------------------------------------------------- |
| `monitoring.bicep`     | Log Analytics and workspace-based Application Insights     |
| `network.bicep`        | VNet, Container Apps subnet, PostgreSQL subnet/private DNS |
| `identity.bicep`       | Web user-assigned managed identity                         |
| `registry.bicep`       | ACR with local admin disabled                              |
| `key-vault.bicep`      | RBAC Key Vault and runtime secret references               |
| `storage.bicep`        | OAuth-first artifact and guidance containers               |
| `search.bicep`         | Keyless Azure AI Search                                    |
| `maps.bicep`           | Keyless Azure Maps                                         |
| `postgres.bicep`       | Private PostgreSQL 16, TLS, and PostGIS allow-list         |
| `foundry.bicep`        | Foundry account, project identity, and model deployments   |
| `rbac.bicep`           | Least-privilege workload assignments                       |
| `container-apps.bicep` | VNet-integrated environment and public web app             |

Modules emit identifiers and endpoints, never secret values. `main.bicep`
combines their outputs into the azd environment contract.
