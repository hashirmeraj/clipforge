FROM brainicism/bgutil-ytdlp-pot-provider:node AS pot-provider

FROM node:20-slim

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

# Install latest yt-dlp and bgutil POT provider plugin
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp bgutil-ytdlp-pot-provider

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
