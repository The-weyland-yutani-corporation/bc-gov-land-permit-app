# Local azd environments

`azd` writes active environment values under `.azure/<environment>/.env`; those
files are ignored and must never be committed. The checked-in `*.env.example`
files list required names only.

Create or select an environment, then set values with `azd env set`. Store the
PostgreSQL administrator password and External ID client secret only in the azd
environment or the deployment system's secret store. Do not copy placeholders
from the examples into a real deployment.
