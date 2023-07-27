FROM node:16-alpine as base

RUN apk add --no-cache libc6-compat git
RUN npm install -g turbo@1.7.4 pnpm@7.27.0 @nestjs/cli@9.3.0

RUN pnpm config set store-dir /app/.pnpm-store

WORKDIR /app

# Build shareable backend and frontend repositories
FROM base as builder

ARG NPM_TOKEN

ENV HUSKY 0
ENV CI 1
ENV NODE_ENV production

COPY .npmrc ./.npmrc

COPY package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml

# Remove "husky install" command in prepare hook
RUN npm pkg delete scripts.prepare

# Installs only prod deps due to NODE_ENV=production
RUN --mount=type=cache,target=/app/.pnpm-store pnpm --filter ./ install

COPY . .

# RUN pnpm run codegen:docker

# FIXME: actually, we need this command in docker. Required futher researches
# RUN pnpm --filter=superdao-backend generate:forbiddenSlugs

# RUN turbo run build --filter=./packages/*

RUN turbo prune --scope=core --out-dir=core --docker

FROM base as core

ARG NPM_TOKEN

ENV CI 1
ENV PORT 8000
ENV NODE_ENV production

COPY --from=builder /app/.npmrc ./.npmrc
RUN echo "//gitlab.superdao.co/:_authToken=$NPM_TOKEN" >> .npmrc

COPY --from=builder /app/core/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,target=/app/.pnpm-store pnpm fetch

COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/core/json ./
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

# Remove "husky install" command in prepare hook
RUN npm pkg delete scripts.prepare

# Installs only prod deps due to NODE_ENV=production
RUN pnpm install --offline --filter core...

COPY --from=builder /app/core/full/ ./

EXPOSE 8000

RUN pnpm run -r build

WORKDIR /app/packages/core

USER node

CMD ["pnpm", "start"]
