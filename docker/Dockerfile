# === Build Stage ===
FROM node:24 AS build

WORKDIR /build

# Install all dependencies (including devDependencies for tsc)
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build


# === Runtime Stage ===
FROM node:24 AS runtime

# Run as non-root user
USER node

WORKDIR /data

# Install only production dependencies
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from build stage and config template
COPY --chown=node:node --from=build /build/dist/ ./dist/
COPY --chown=node:node docker/config.json ./

# Expose service port
EXPOSE 11411

# Start the server
CMD ["node", "dist/app.js"]
