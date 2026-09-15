# This project is mostly a CLI-driven data/embeddings pipeline (tsx scripts),
# not a hardened production server, so devDependencies (tsx, nest cli, vitest)
# stay in the image to run `npm run <script>` the same way inside or outside
# Docker. There is no slim runtime stage to strip them from.
FROM node:24.15.0-bookworm-slim
WORKDIR /app

# Debian slim images ship without OpenSSL; without it Prisma's query engine
# guesses the wrong build and can fail at runtime, not just build time.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy just what `npm ci`'s postinstall (`prisma generate`) needs first, so
# dependency install is cached separately from application source changes.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
