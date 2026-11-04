FROM node:22-slim
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
