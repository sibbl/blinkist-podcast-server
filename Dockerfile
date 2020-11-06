FROM mwader/static-ffmpeg:4.2.2 AS ffmpeg-binaries
FROM node:14-alpine
COPY --from=ffmpeg-binaries /ffmpeg /ffprobe /usr/local/bin/
ENV CHROME_BIN="/usr/bin/chromium-browser" \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true" \
    PUPPETEER_ARGS="--no-sandbox --headless --disable-gpu --disable-dev-shm-usage"
RUN set -x && apk add chromium
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD [ "node", "index.mjs" ]