# Blinkist Free Daily Blinks podcast server (unofficial)

![ci](https://github.com/sibbl/blinkist-podcast-server/workflows/ci/badge.svg)
[![CodeFactor](https://www.codefactor.io/repository/github/sibbl/blinkist-podcast-server/badge)](https://www.codefactor.io/repository/github/sibbl/blinkist-podcast-server)

This application makes the free daily blinks available accessible via a Podcast feed. You can add the feeds to the Podcatcher of your choice.

**Please consider paying for Blinkist** if you like their content and consume the daily blinks using this tool ❤

## Usage

You have different possibilities:

1. Use the prebuilt Docker image [`sibbl/blinkist-podcast-server`](https://hub.docker.com/r/sibbl/blinkist-podcast-server)

    1. Either run it manually like `docker run -d -p 8080:8080 -v ./data:/usr/src/app/data sibbl/blinkist-podcast-server`

    2. Or use the `docker-compose.yml` file of this repo and run `docker-compose up`

2. Or download the source and run `npm ci` and then `npm start` (requires Node.js 14 or newer)

By default, this will start the server on port 8080. You can then add the following feed URLs to your Podcatcher:

| Blink language | Feed URL                        |
| -------------- | ------------------------------- |
| German         | `http://localhost:8080/feed/de` |
| English        | `http://localhost:8080/feed/en` |

Feeds can be paged using the `page` query parameter, e.g. `?page=2` will
return the second page with older entries. Pagination links are included in
the feed using the [RFC&nbsp;5005](https://www.rfc-editor.org/rfc/rfc5005) link
relations.

## Features

* Every 15 minutes, the daily blink websites are checked for a new blink.

* If not already done, it downloads book meta data and the chapter's audio binaries.

* The audio binaries are concatenated, converted to AAC and enriched with chapter marks as well as a cover image using ffmpeg.

## Configuration

You can limit how many episodes are stored per language by adjusting `episodesToKeep` in `config.mjs`. By default all episodes are kept. Uncomment the sample block in `config.mjs` and change the numbers to fit your needs:

You may also set `audioBitrate` to control the bitrate of the AAC files. Lower values reduce file size, e.g. `80` results in about 80&nbsp;kbit/s.

```javascript
export default {
  languages: ["de", "en"],
  // audioBitrate: 80, // encode using ~80 kbit/s AAC
  // episodesToKeep: {
  //   de: 30,
  //   en: 20
  // },
  episodesToKeep: {},
};
```
Old episodes exceeding the configured limits will be removed automatically after each scrape run.

## Remarks

Please note that the usage might be illegal as you scrape data which is not yours! I'm not affiliated with any of the sites scraped or tools used here and everything you do with it is on your own risk. Again, please use this reponsibly and pay for Blinkist if you like their service ❤ thanks!
