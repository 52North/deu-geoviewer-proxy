import config from "../config.js";
import { Manager as WhitelistManager } from "../whitelist.js";
import { createLogger } from "../logging.js";
const log = createLogger("whitelist-worker");

export default () => {
  log.info("Starting whitelist Worker...");
  new WhitelistManager(config.whitelist).on("update", (whitelist) => {
    log.trace("Sending whitelist to master");
    process.send({
      cmd: "whitelist.update",
      whitelist: [...whitelist.get()],
    });
  });
};
