# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/permit-readiness-agent/package.json apps/permit-readiness-agent/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/guidance-search/package.json packages/guidance-search/package.json
COPY packages/jurisdiction-config/package.json packages/jurisdiction-config/package.json
COPY packages/observability/package.json packages/observability/package.json
RUN pnpm install --frozen-lockfile

COPY apps/permit-readiness-agent apps/permit-readiness-agent
COPY packages/contracts packages/contracts
COPY packages/domain packages/domain
COPY packages/guidance-search packages/guidance-search
COPY packages/jurisdiction-config packages/jurisdiction-config
COPY packages/observability packages/observability
RUN pnpm --filter @permit-readiness/contracts build \
 && pnpm --filter @permit-readiness/domain build \
 && pnpm --filter @permit-readiness/guidance-search build \
 && pnpm --filter @permit-readiness/jurisdiction-config build \
 && pnpm --filter @permit-readiness/observability build \
 && pnpm --filter @permit-readiness/agent build \
 && pnpm deploy --legacy --filter @permit-readiness/agent --prod /app

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8088
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 8088
CMD ["node", "--import", "@azure/monitor-opentelemetry/loader", "--import", "./dist/instrumentation.js", "--enable-source-maps", "dist/index.js"]
