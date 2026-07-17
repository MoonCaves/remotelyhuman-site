FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

# Coolify/Traefik health check (docs: knowledge-base/health-checks). curl is
# present in nginx:alpine; use 127.0.0.1 because BusyBox wget resolves
# localhost to IPv6 [::1] where nginx isn't listening. Verified 200 in-container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -fsS -o /dev/null http://127.0.0.1:80/ || exit 1
