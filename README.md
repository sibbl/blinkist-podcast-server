# (Unofficial) Blinkist Free Daily Blinks podcast server

This application makes the free daily blinks available to you in a Podcast feed.
You can add this to the Podcatcher of your choice.

**Please consider paying for the wonderful service of Blinkist** if you like their content and consume the daily blinks using this tool ❤

## Usage

You have different possibilities:

1. Use the prebuilt Docker image [`sibbl/blinkist-podcast-server`](https://hub.docker.com/r/sibbl/blinkist-podcast-server)

   1.1. Either run it manually like `docker run -d -p 8080:8080 -v ./data:/usr/src/app/data sibbl/blinkist-podcast-server`

   1.1. Or use the `docker-compose.yml` file of this repo and run `docker-compose up`

1. Or download the source and run `npm ci` and then `npm start` (requires Node.js 14 or newer)

By default, this will start the server on port 8080. You can then add the following feed URLs to your Podcatcher:

| Blink language | Feed URL                        |
| -------------- | ------------------------------- |
| German         | `http://localhost:8080/feed/de` |
| English        | `http://localhost:8080/feed/en` |

## Features

- Every 15 minutes, the daily blink websites are scraped.
- If no already done, it downloads book meta data as well as the audio binaries.
- The audio binaries of book chapters are concatenated, converted to AAC and enriched with chapter marks as well as a cover image using ffmpeg.

## Remarks

Please note that the usage might be illegal as you scrape data which is not yours! I'm not affiliated with any of the sites scraped or tools used here and everything you do with it is on your own risk. Again, please use this reponsibly and pay for Blinkist if you like their service!
