# Managed identity and RBAC matrix

Local keys are disabled for Foundry, Search, Maps, Storage, ACR administration,
and Application Insights ingestion. Runtime access uses these assignments:

| Principal                  | Scope           | Role                                     | Reason                                      |
| -------------------------- | --------------- | ---------------------------------------- | ------------------------------------------- |
| Web user-assigned identity | ACR             | AcrPull                                  | Pull the Next.js image                      |
| Web user-assigned identity | Key Vault       | Key Vault Secrets User                   | Resolve database and External ID references |
| Web user-assigned identity | Foundry project | Foundry User                             | Invoke the hosted agent server-side         |
| Web user-assigned identity | Azure Maps      | Azure Maps Search and Render Data Reader | Support a future browser-token flow         |
| Foundry project identity   | ACR             | AcrPull                                  | Pull hosted-agent images                    |
| Foundry project identity   | Foundry account | Cognitive Services OpenAI User           | Call the configured model                   |
| Foundry project identity   | Azure AI Search | Search Index Data Reader                 | Query curated guidance                      |
| Foundry project identity   | Storage         | Storage Blob Data Reader                 | Read approved artifacts                     |

The deployment initialization identity additionally needs **Search Service
Contributor** and **Search Index Data Contributor** for index/schema and
document synchronization. **Storage Blob Data Contributor** is needed only when
an approved corpus is sourced from Storage. Assign these roles to the
environment-specific OIDC workload identity; do not use Search keys.

GitHub Actions must use workload identity federation/OIDC. Its deployment
principal needs resource provisioning rights and User Access Administrator (or
equivalent delegated role-assignment rights) at the target resource group. Do
not create client secrets for CI.

Use distinct development and production principals with GitHub environment
subjects (`repo:<owner>/<repo>:environment:development` and
`repo:<owner>/<repo>:environment:production`). Grant Contributor only on the
matching resource group. Grant User Access Administrator only when reviewed
provisioning is enabled; a deploy-only principal should not retain it. The
VNet-connected deployment runner does not replace Azure RBAC and must not carry
long-lived Azure credentials.

Hosted-agent identity is preview functionality. Before production, verify the
deployed agent resolves to the intended project managed identity and that
Search/Storage calls succeed without keys.
