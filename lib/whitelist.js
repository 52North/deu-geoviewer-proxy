import request from "request-promise";
import { EventEmitter } from "events";
import config from "./config.js";
import { write } from "./writer.js";
import sleep from "./util/sleep.js";
import { resolve } from "path";
import { createLogger } from "./logging.js";
const log = createLogger("whitelist");

const storagePath = resolve(
  process.cwd(),
  config.whitelist?.storageDir ?? "./whitelist.json"
);

const readStoredWhitelist = () => {
  try {
    return require(storagePath);
  } catch (err) {
    log.warn("No stored whitelist found");
    return [];
  }
};

const storedWhitelist = readStoredWhitelist();

const logRequest = (options, ms) => {
  let url = options.url;
  if (options.qs) {
    const query = Object.keys(options.qs)
      .map((key) => `${key}=${encodeURIComponent(options.qs[key])}`)
      .join("&");
    url += `?${query}`;
  }
  log.debug(`${options.method || "GET"} ${url} took ${ms} ms`);
};

class WhitelistManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;

    log.info("Whitelist config: ", JSON.stringify(config));

    this.whitelist = new Whitelist(config.domains);

    process.nextTick(() => this.refresh());
  }

  async refresh() {
    if (!this.config.sparql.enabled) return;

    log.info("Updating WhitelistManager");
    const domains = new Set();
    let err = null;
    for (const format of this.config.formats) {
      log.info(`fetching domains for format ${format}`);
      const { results, error } = await this.fetch(format);
      if (!err && error) {
        err = error;
      }
      if (results?.size > 0) {
        log.info(`found ${results.size} domains for format ${format}`);
        for (const domain of results) {
          domains.add(domain);
        }
      } else {
        log.warn(`found no domains for format ${format}`);
      }
    }
    if (err) {
      log.error({ err }, "Error updating");
    }

    // add the additional configured domains
    for (const domain of this.config.domains) {
      domains.add(domain);
    }

    log.info("Fetched domains: " + domains.size);
    // only replace the complete whitelist if there wasn't an error
    if (err) {
      domains.forEach((domain) => this.whitelist.add(domain));
    } else {
      this.whitelist.set(domains);
    }
    this.emit("update", this.whitelist);
    this.schedule();

    const currentDomains = this.whitelist.get();
    write(storagePath, [...currentDomains]);
    log.info(`Updated whitelist with ${currentDomains.size} domains.`);
  }

  schedule() {
    const { enabled, updateInterval } = this.config.sparql;
    if (enabled && updateInterval > 0) {
      // schedule a refresh
      sleep(updateInterval * 60 * 1000).then(() => this.refresh());
      log.info("scheduled new update in", updateInterval, "minutes");
    }
  }

  async fetch(format) {
    const { url, maxErrorCount } = this.config.sparql

    const query = `
      PREFIX dcat: <http://www.w3.org/ns/dcat#>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX ft: <http://publications.europa.eu/resource/authority/file-type/>

      SELECT DISTINCT ?domain
      WHERE {
          [ a dcat:Dataset ; dcat:distribution ?distribution ].
          ?distribution dct:format ft:${format} .
          {
            { ?distribution dcat:downloadURL ?url . }
            UNION
            { ?distribution dcat:accessURL ?url .  }
        }
        BIND(REPLACE(str(?url), "^(?:https?://)?(?:[^@]+@)?(\\\\[[a-fA-F0-9:.]+\\\\]|[^:#/?]+)(?::[0-9]+)?(?:/.*)?$", "$1") AS ?domain)
      }
    `
    const options = {
      url: url,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/csv"
      },
      form: {
        query,
        locale: "en"
      }
    }

    let errorCount = 0;
    
    while (true) {
      const before = new Date().getTime();
      try {
        const body = await request(options)
        const domains = body.split(/\r?\n/).slice(1).filter(x => !!x).map(x => x.replace(/^"/, "").replace(/"$/, ""))
        return { results: new Set(domains) }
      } catch (error) {
        logRequest(options, new Date().getTime() - before);
        log.error(error)
        if (++errorCount >= maxErrorCount) {
          return { results: new Set() , error }
        } else {
          const date = new Date(0);
          date.setSeconds(1 << errorCount);
          const duration = date.toISOString().substring(11, 19);
          log.info(
            `Error count: ${errorCount} - Continuing update after ${duration}`
          );
          await sleep(date.getTime);
        }
      }
    }
  }
}

class Whitelist {
  constructor(domains) {
    this.set(domains);
  }

  get() {
    return this.domains;
  }

  set(domains) {
    if (Array.isArray(domains)) {
      if (!this.domains) {
        this.domains = new Set(domains);
        this.mergeWithStoredDomains();
      } else {
        for (const domain of domains) {
          this.domains.add(domain);
        }
      }
    } else if (domains instanceof Whitelist) {
      this.set(domains.get());
    } else if (domains instanceof Set) {
      this.domains = domains;
      this.mergeWithStoredDomains();
    } else if (domains) {
      throw new Error(`unsupported whitelist type: ${domains}`);
    } else {
      this.domains = new Set();
      this.mergeWithStoredDomains();
    }
  }

  mergeWithStoredDomains() {
    if (storedWhitelist) {
      for (const domain of storedWhitelist) {
        this.domains.add(domain);
      }
    }
  }

  add(domain) {
    if (this.domains) {
      this.domains.add(domain);
    } else {
      this.domains = new Set([domain]);
    }
  }

  contains(domain) {
    return domain && this.domains.has(domain);
  }
}

export default Whitelist;
export const Manager = WhitelistManager;
