# Orbyn Planner's web app: a static build served by nginx as an unprivileged user.
# Build from this folder (web/):
#   docker build --build-arg VITE_ENGINE_URL=https://api-staging.orbyn.dev -t orbyn-planner-web .
# The engine's address is fixed at build time: the page talks to that engine and the
# Content-Security-Policy allows that one origin. No address means no engine, as `npm run build`.
FROM node:22-alpine AS build
ARG VITE_ENGINE_URL=
ARG GIT_SHA=dev
ENV VITE_ENGINE_URL=$VITE_ENGINE_URL
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Type-check, bundle, then write the security headers for this build (the policy names the
# engine and the hash of the page's one inline script).
RUN npm run build \
 && node scripts/headers.mjs dist/index.html /headers.conf \
 && echo "$GIT_SHA" > dist/version.txt

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /src/dist /usr/share/nginx/html
