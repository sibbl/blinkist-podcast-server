import Scraper from "./utils/scraper.mjs";
import cron from "cron";

export default class Runner {
  constructor({ languages, scraperCron, scrapeParallel, headless }) {
    this.languages = languages;
    this.scrapeParallel = scrapeParallel;
    this.headless = headless;

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
    const scraper = new Scraper({ language, headless: this.headless });
    await scraper.scrape();
  }
}
