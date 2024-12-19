FROM node:22-alpine AS build

COPY ../. /app
WORKDIR /app

RUN corepack enable pnpm && \
    pnpm install

RUN pnpm run build

FROM node:22-alpine

RUN apk update --no-cache && \
  apk add --no-cache curl=8.11.1-r0

LABEL maintainer="Nico Jensch <root@dr460nf1r3.org>"
LABEL description="NestJS backend container for the container manager, ready to use for a Docker in Docker test environment"
LABEL version="1.0"
LABEL org.opencontainers.image.source="https://github.com/dr460nf1r3/container-manager"
LABEL org.opencontainers.image.authors="Nico Jensch <root@dr460nf1r3.org>"
LABEL org.opencontainers.image.description="NestJS backend container for the container manager, ready to use for a Docker in Docker test environment"
LABEL org.opencontainers.image.version="1.0"

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl localhost:3000/health || exit 1

COPY --from=build /app/dist /app
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-lock.yaml

WORKDIR /app
RUN corepack enable pnpm && \
    pnpm install --prod

WORKDIR /app

EXPOSE 3000

CMD ["node", "/app/main.js"]
