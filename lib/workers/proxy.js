const cluster = require("cluster");
const config = require("../config");
const Proxy = require("../proxy");
const log = require("../logging")("proxy-worker");

module.exports = () => {
  log.info("Starting Worker...");

  const proxy = new Proxy(config.proxy);
  // set up the initial whitelist
  proxy.whitelist.set(config.whitelist.domains);
  // listen for whitelist changes
  process.on("message", (message) => {
    if (message.cmd === "whitelist.update") {
      log.debug("Whitelist changed.");
      proxy.whitelist.set(message.whitelist);
    }
  });
  process.on("message", (message) => {
    if (message.cmd === "whitelist.newRedirectDomain") {
      proxy.whitelist.add(message.domain);
    }
  });
  log.info("Starting server on port " + config.proxy.port);

  // start the server
  proxy.start().on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      log.error("Address in use, stopping");
      cluster.worker.kill();
    }
  });

  log.info(
    "Proxy Worker started with",
    proxy.whitelist.get().size,
    "domains in memory"
  );
};
