# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies (including dev) for building
COPY package*.json ./
RUN npm ci

# Copy build configuration and sources
COPY tsconfig.json nest-cli.json ./
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

# Default port (can be overridden by config.json)
EXPOSE 8083

# Default command uses the bundled config file; override with docker run args if needed
CMD ["node", "dist/src/main.js", "--config", "/app/config.json"]


