# === Build Stage ===
FROM node:24 AS build

WORKDIR /build

# Install all dependencies (including devDependencies for tsc)
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to dist/
RUN npm run build


# === Runtime Stage ===
FROM node:24 AS runtime

# Run as non-root user
USER node

WORKDIR /data

# Install only production dependencies
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from build stage
COPY --chown=node:node --from=build /build/dist/ ./dist/

# Copy config template (overridable via volume mount at runtime)
COPY --chown=node:node docker/config.json ./

# Expose service port
EXPOSE 11411

# Start the server
CMD ["node", "dist/app.js"]
