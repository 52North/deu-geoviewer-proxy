const cluster = require("cluster");
const os = require("os");
const log = require("../logging")("master");

class Cluster {
  constructor() {
    this.whitelist = null;
    this.workers = {
      whitelist: null,
      proxy: {},
    };
  }

  start() {
    log.info("Forking...");
    const cpus = os.cpus().length;
    this.forkWhitelistWorker();
    for (let i = 0; i < cpus; ++i) {
      this.forkProxyWorker();
    }
  }

  hasProxyWorkers() {
    return this.workers.proxy.keys().length > 0;
  }

  restart(worker, code, signal) {
    log.info("worker " + worker.process.pid + " died:", signal || code);

    // respect that...
    if (worker.suicide) {
      if (!hasProxyWorkers()) {
        return process.exit(1);
      } else {
        return;
      }
    }

    if (worker.id === this.workers.whitelist.id) {
      this.forkWhitelistWorker();
    } else {
      delete this.workers.proxy[worker.id];
      this.forkProxyWorker();
    }
  }
  sendMessageToWorkers(message) {
    Object.values(this.workers.proxy).forEach((worker) => {
      log.trace("Sending message to worker", worker.id);
      worker.send(message);
    });
  }

  forkWhitelistWorker() {
    // keep track of the whitelist worker
    this.workers.whitelist = cluster.fork({ WORKER_TYPE: "whitelist" });
    this.workers.whitelist.on("message", (message) => {
      log.trace("Received message from whitelist worker");
      if (message?.cmd === "whitelist.update") {
        // save the whitelist for newly created proxy workers
        this.whitelist = message.whitelist;
        // propagate whitelist to proxy workers
        this.sendMessageToWorkers(message);
      }
    });
    return this.workers.whitelist;
  }

  forkProxyWorker() {
    const worker = cluster.fork({ WORKER_TYPE: "proxy" });
    // keep track of the proxy worker
    this.workers.proxy[worker.id] = worker;
    // send whitelist to new worker
    worker.on("listening", () => {
      log.trace("Worker", worker.id, "is online");
      if (this.whitelist) {
        log.trace("Sending message to worker", worker.id);
        worker.send({ cmd: "whitelist.updated", whitelist });
      }
    });

    worker.on("message", (message) => {
      if (message?.cmd === "whitelist.newRedirectDomain") {
        log.trace("received new redirect domain");
        this.sendMessageToWorkers(message);
      }
    });
    return worker;
  }
}

module.exports = () => {
  const c = new Cluster();
  cluster.on("exit", () => c.restart());
  c.start();
};
