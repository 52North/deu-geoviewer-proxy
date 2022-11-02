import cluster from "cluster";
import { cpus } from "os";
import { createLogger } from "../logging.js";
const log = createLogger("master");

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
    process.on("SIGTERM", () => {
      Object.values(cluster.workers).forEach((worker) => worker.disconnect());
    });
    const n = cpus().length;
    this.forkWhitelistWorker();
    for (let i = 0; i < n; ++i) {
      this.forkProxyWorker();
    }
  }

  hasProxyWorkers() {
    return Object.keys(this.workers.proxy).length > 0;
  }

  restart(worker, code, signal) {
    log.info(`worker #${worker.id} died: ${signal || code}`);

    if (worker.id === this.workers.whitelist.id) {
      if (!worker.exitedAfterDisconnect) {
        this.forkWhitelistWorker();
      }
    } else {
      delete this.workers.proxy[worker.id];
      if (!worker.exitedAfterDisconnect) {
        this.forkProxyWorker();
      }
    }

    if (!this.hasProxyWorkers()) {
      return process.exit();
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

export default () => {
  const c = new Cluster();
  cluster.on("exit", (worker, code, signal) => c.restart(worker, code, signal));
  c.start();
};
