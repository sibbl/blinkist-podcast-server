import Server from "./src/server.mjs";
import Runner from "./src/runner.mjs";
import config from "./config.mjs";

const runner = new Runner(config);
runner.schedule();
runner.run();

const server = new Server(config);
server.run();
