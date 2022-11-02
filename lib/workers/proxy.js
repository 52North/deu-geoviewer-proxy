import cluster from "cluster";
import config from "../config.js";
import Proxy from "../proxy.js";
import { createLogger } from "../logging.js";
const log = createLogger("proxy-worker");

export default () => {
  log.info("Starting Worker...");

  const proxy = new Proxy(config.proxy);
  // set up the initial whitelist
  proxy.whitelist.set(config.whitelist.domains);
  // listen for whitelist changes
  process.on("message", ({ cmd, whitelist, domain }) => {
    if (cmd === "whitelist.update") {
      log.debug("Whitelist changed.");
      proxy.whitelist.set(whitelist);
    } else if (cmd === "whitelist.newRedirectDomain") {
      proxy.whitelist.add(domain);
    }
  });
  log.info("Starting server on port " + config.proxy.port);

  // start the server
  proxy.start().on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      log.error("Address in use, stopping");
      cluster.worker.disconnect();
    }
  });

  log.info(
    "Proxy Worker started with",
    proxy.whitelist.get().size,
    "domains in memory"
  );
};
