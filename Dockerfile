FROM node:14-alpine
COPY --from=mwader/static-ffmpeg:4.2.2 /ffmpeg /ffprobe /usr/local/bin/
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD [ "node", "index.mjs" ]