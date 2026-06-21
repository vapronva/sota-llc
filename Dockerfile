FROM docker.io/library/node:26-alpine AS base

RUN sed --in-place 's!https://dl-cdn.alpinelinux.org/alpine!https://linux.sex/dl-cdn.alpinelinux.org!g' /etc/apk/repositories || true && \
    apk --verbose update && \
    apk --verbose upgrade --available && \
    apk --verbose add ca-certificates tzdata && \
    update-ca-certificates && \
    apk cache clean

FROM base AS builder

RUN apk --verbose add git && \
    npm install --global pnpm@11 && \
    npm cache clean --force && \
    apk cache clean

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN --mount=type=secret,id=NODE_ENV \
    --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    export NODE_ENV="$(cat /run/secrets/NODE_ENV)" \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" && \
    pnpm run build

FROM base

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /usr/src/app/.next/standalone ./
COPY --from=builder --chown=node:node /usr/src/app/.next/static ./.next/static
COPY --from=builder --chown=node:node /usr/src/app/public ./public

USER node

EXPOSE 3000

ENTRYPOINT ["node", "server.js"]
