import { scrapeDailyBlinkAsync } from "./utils/downloader.mjs";
import cron from "cron";

export default class Scraper {
  constructor({ languages, scraperCron }) {
    this.languages = languages;

    this.cronJob = new cron.CronJob(scraperCron, () => {
      this.run();
    });
  }

  schedule() {
    this.cronJob.start();
  }

  async run() {
    await Promise.all(
      this.languages.map((language) => scrapeDailyBlinkAsync(language))
    );
  }
}
