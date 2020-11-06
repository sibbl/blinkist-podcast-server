import puppeteerExtra from "puppeteer-extra";
import pluginStealth from "puppeteer-extra-plugin-stealth";
import randomUseragent from "random-useragent";

export default class Crawler {
  constructor(timeout, headless = false) {
    this.browser = null;
    this.page = null;
    this.launchOptions = {
      headless,
      executablePath: process.env.CHROME_BIN || null,
      args: (process.env.PUPPETEER_ARGS || "").split(" "),
    };
    this.pageOptions = {
      waitUntil: "networkidle2",
      timeout,
    };
  }

  async start() {
    puppeteerExtra.use(pluginStealth());
    this.browser = await puppeteerExtra.launch(this.launchOptions);
    this.page = await this.browser.newPage();
    await this.page.setRequestInterception(true);
    this.page.on("request", (request) => {
      if (
        ["image", "stylesheet", "font", "script"].indexOf(
          request.resourceType()
        ) !== -1
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  async goToAndGetHtml(url) {
    try {
      await this.page.setUserAgent(randomUseragent.getRandom());
      await this.page.goto(url, this.pageOptions);
      await this.page.waitForFunction('document.querySelector("body")');
      return await this.page.content();
    } catch (error) {
      console.log("crawler failed to fetch " + url, error);
      return null;
    }
  }

  async downloadJsonViaXhr(link) {
    const text = await this.downloadTextViaXhr(link);
    return JSON.parse(text);
  }

  async downloadTextViaXhr(link) {
    return await this.page.evaluate((link) => {
      return fetch(link, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        method: "GET",
      }).then((r) => r.text());
    }, link);
  }

  close() {
    if (!this.browser) {
      this.browser.close();
    }
  }
}
