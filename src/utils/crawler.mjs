import puppeteerExtra from "puppeteer-extra";
import pluginStealth from "puppeteer-extra-plugin-stealth";
import randomUseragent from "random-useragent";

export default class Crawler {
  constructor(timeout, headless = false) {
    this.browser = null;
    this.page = null;
    this.stopping = false;
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
    console.log("Starting crawler... spinning up browser and page");
    puppeteerExtra.use(pluginStealth());
    this.browser = await puppeteerExtra.launch(this.launchOptions);
    this.browser.on("disconnected", () => {
      if(this.stopping === true) return;
      console.error("Browser disconnected :(");
      const browserProcess = this.browser.process();
      if (browserProcess) {
        console.error("Killing browser process");
        browserProcess.kill("SIGINT");
      }
      this.stop();
      this.start();
    });

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
      this.close();
      return null;
    }
  }

  async downloadJsonViaXhr(link) {
    const text = await this.downloadTextViaXhr(link);
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  }

  async downloadTextViaXhr(url) {
    try {
      return await this.page.evaluate((url) => {
        return fetch(url, {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
          method: "GET",
        }).then((r) => r.text());
      }, url);
    } catch (e) {
      console.log(
        "failed to evaluate and get text failed to fetch " + url,
        error
      );
      this.close();
      return null;
    }
  }

  close() {
    this.stopping = true;
    if (this.page) {
      try {
        this.page.close();
      } catch {}
      this.page = null;
    }
    if (this.browser) {
      try {
        this.browser.close();
      } catch {}
      this.browser = null;
    }
  }
}
