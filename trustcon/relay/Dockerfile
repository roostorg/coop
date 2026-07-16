# Container for the TrustCon label relay (Fly deploy). Env comes from Fly
# secrets, not a .env file, so the entrypoint is plain `node index.mjs`.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs ./
ENV PORT=8090
EXPOSE 8090
CMD ["node", "index.mjs"]
