import Scraper from "./utils/scraper.mjs";
import cron from "cron";
import { pruneOldBooksAsync } from "./utils/storage.mjs";

export default class Runner {
  constructor({ languages, episodesToKeep = {}, scraperCron, scrapeParallel, headless, audioBitrate }) {
    this.languages = languages;
    this.scrapeParallel = scrapeParallel;
    this.headless = headless;
    this.audioBitrate = audioBitrate;
    this.episodesToKeep = episodesToKeep;

    this.cronJob = new cron.CronJob(scraperCron, () => {
      this.run();
    });
  }

  schedule() {
    this.cronJob.start();
  }

  async run() {
    if (this.scrapeParallel) {
      await Promise.all(
        this.languages.map((language) => this.singleRun(language))
      );
    } else {
      for (let language of this.languages) {
        await this.singleRun(language);
      }
    }
  }

  async singleRun(language) {
    const scraper = new Scraper({
      language,
      headless: this.headless,
      audioBitrate: this.audioBitrate,
    });
    await scraper.scrape();
    const keep = this.episodesToKeep?.[language];
    const limit = Number.isFinite(keep) ? keep : Infinity;
    await pruneOldBooksAsync(language, limit);
  }
}
