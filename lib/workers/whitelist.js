const config = require("../config");
const WhitelistManager = require("../whitelist").Manager;
const log = require("../logging")("whitelist-worker");

module.exports = () => {
  log.info("Starting whitelist Worker...");
  new WhitelistManager(config.whitelist).on("update", (whitelist) => {
    log.trace("Sending whitelist to master");
    process.send({
      cmd: "whitelist.update",
      whitelist: [...whitelist.get()],
    });
  });
};
