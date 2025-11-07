# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies (including dev) for building
COPY package*.json ./
RUN npm ci

# Copy build configuration and sources
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY config.json ./config.json

# Build the project
RUN npm run build

FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    HUSKY=0
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Bring in the compiled app and default config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config.json ./config.json
COPY config.docker.json ./config.docker.json

# Default port (matches config.json)
EXPOSE 8084

# Default command uses the docker config; override with docker run args if needed
CMD ["node", "dist/main.js", "--config", "/app/config.docker.json"]


