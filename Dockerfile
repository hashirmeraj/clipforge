FROM brainicism/bgutil-ytdlp-pot-provider:node AS pot-provider
FROM denoland/deno:bin AS deno-bin

FROM node:22-slim

# Copy Deno binary for yt-dlp EJS JavaScript challenges
COPY --from=deno-bin /deno /usr/local/bin/deno

# Install ffmpeg, python3, pip, curl, ca-certificates, and canvas/botguard runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp, yt-dlp-ejs (JS challenge solvers), and bgutil POT provider plugin
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp yt-dlp-ejs bgutil-ytdlp-pot-provider

# Copy prebuilt BotGuard POT provider server
COPY --from=pot-provider /app /opt/pot-provider

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV PATH="/usr/local/bin:${PATH}"

CMD ["node", "server.js"]
