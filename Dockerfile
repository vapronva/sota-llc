FROM docker-registry.selectel.ru/library/node:25-alpine AS builder

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=secret,id=NPM_PROXY_URL \
    --mount=type=secret,id=NPM_PROXY_USERNAME \
    --mount=type=secret,id=NPM_PROXY_PASSWORD \
    NPM_PROXY_URL="$(cat /run/secrets/NPM_PROXY_URL)" && \
    NPM_PROXY_USERNAME="$(cat /run/secrets/NPM_PROXY_USERNAME)" && \
    NPM_PROXY_PASSWORD="$(cat /run/secrets/NPM_PROXY_PASSWORD)" && \
    REGISTRY_HOST=$(echo "${NPM_PROXY_URL}" | sed -E 's!^https?://!!' | sed 's!/$!!') && \
    npm config set registry "${NPM_PROXY_URL}" && \
    npm config set "//${REGISTRY_HOST}/:_auth"="$(echo -n "$NPM_PROXY_USERNAME:$NPM_PROXY_PASSWORD" | base64)" && \
    npm config set replace-registry-host "${REGISTRY_HOST}" && \
    npm install --global pnpm@10 && \
    pnpm config set registry "${NPM_PROXY_URL}" && \
    pnpm config set "//${REGISTRY_HOST}/:_auth"="$(echo -n "$NPM_PROXY_USERNAME:$NPM_PROXY_PASSWORD" | base64)" && \
    pnpm config set replace-registry-host "${REGISTRY_HOST}" && \
    pnpm install

COPY . .

RUN --mount=type=secret,id=NODE_ENV \
    --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    export NODE_ENV="$(cat /run/secrets/NODE_ENV)" \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" && \
    pnpm run build

FROM docker-registry.selectel.ru/library/node:25-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/.next/standalone ./
COPY --from=builder /usr/src/app/.next/static ./.next/static
COPY --from=builder /usr/src/app/public ./public

EXPOSE 3000

ENTRYPOINT ["node", "server.js"]
