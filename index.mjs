import Server from "./src/server.mjs";
import Scraper from "./src/scraper.mjs";
import config from "./config.mjs";

const scraper = new Scraper(config);
scraper.schedule();
scraper.run();

const server = new Server(config);
server.run();
