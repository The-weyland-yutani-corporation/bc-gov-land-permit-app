# External prerequisites

## Microsoft Entra External ID

Production requires an External ID tenant and confidential web application
registration administered outside this repository:

1. register `/api/auth/callback/entra` as the production redirect URI;
2. configure the exact issuer, audience, and supported user flows;
3. generate a client secret with an approved rotation period and store it only
   in the azd/deployment secret store;
4. provision the External ID subject as an application user with an explicit
   membership in `ENTRA_EXTERNAL_ID_ORGANIZATION_ID`;
5. set every `ENTRA_EXTERNAL_ID_*` value and `AUTH_SESSION_SECRET`; and
6. complete account linking, recovery, consent, privacy, and records review.

The application validates the authorization-code response with MSAL, PKCE,
state, nonce, issuer, audience, and lifetime before issuing an encrypted,
HTTP-only application session. Missing membership or configuration fails closed.
Infrastructure readiness is not identity go-live approval.

## Azure Maps and B.C. map data

Bicep creates a keyless Azure Maps account and assigns the web identity the
Search and Render Data Reader role. Production browser use still requires a
server-side Entra token endpoint; never expose an Azure Maps subscription key.

Before enabling B.C.-specific layers:

- confirm source authority, licence, attribution, update frequency, and
  redistribution terms with the B.C. Data Catalogue or responsible ministry;
- document whether geometry is authoritative or demonstration-only;
- pin a reviewed dataset/version and retain provenance;
- validate coordinate reference systems and transformations; and
- provide a non-map accessible location-entry path.

Do not imply that a map layer or synthetic zone determines permit jurisdiction
or legal eligibility.

## Subscription readiness

Confirm resource providers, model availability/quota, regional data residency,
preview acceptance, DNS ownership, budgets, alert routing, and the roles in
[`RBAC.md`](RBAC.md) before provisioning.
