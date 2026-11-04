# Errand agent: Node 22 + the Kite Passport CLI (kpass).
# Build from the repository root:  docker build -f apps/agent/Dockerfile .
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates jq tar bash \
  && rm -rf /var/lib/apt/lists/*

# Kite Passport CLI (installs kpass and ksearch into /root/.kpass, links into /root/.local/bin).
# Review https://cli.gokite.ai/install.sh before trusting it; it verifies checksums of what it downloads.
RUN curl -fsSL https://cli.gokite.ai/install.sh | bash
ENV PATH="/root/.local/bin:/root/.kpass/bin:${PATH}"

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/agent/package.json apps/agent/
RUN pnpm install --frozen-lockfile --filter @errand/agent...

COPY packages/core packages/core
COPY apps/agent apps/agent

ENV NODE_ENV=production \
    PORT=8787 \
    KPASS_WORKDIR=/root

COPY apps/agent/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fs http://localhost:${PORT}/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "--filter", "@errand/agent", "start"]
