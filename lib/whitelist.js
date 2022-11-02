import request from "request-promise";
import { parse } from "url";
import { EventEmitter } from "events";
import config from "./config.js";
import { write } from "./writer.js";
import sleep from "./util/sleep.js";
import permutateCase from "./util/permutateCase.js";
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
  log.debug(`GET ${url} took ${ms} ms`);
};

const getDomain = (url) => {
  try {
    const domain = parse(url).host;
    return domain?.toLowerCase().replace(/:[0-9]+$/, "");
  } catch (e) {
    log.warn("Error parsing domain: ", url, e);
  }
};

const extractDomains = (body, requestedFormat, domains) => {
  const addURL = (url) => {
    const domain = getDomain(url);
    if (domain && !domains.has(domain)) {
      log.trace("adding domain", domain);
      domains.add(domain);
    }
  };
  const { results } = body?.result;
  results?.forEach((p) => {
    p.distributions?.forEach(({ format, download_url, access_url }) => {
      if (requestedFormat.toLowerCase() === format?.id.toLowerCase()) {
        if (download_url) {
          if (Array.isArray(download_url)) {
            download_url.forEach(addURL);
          } else {
            addURL(download_url);
          }
        }
        if (access_url) {
          if (Array.isArray(access_url)) {
            access_url.forEach(addURL);
          } else {
            addURL(access_url);
          }
        }
      }
    });
  });
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
    if (!this.config.ckan.enabled) return;

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
    domains.add(...this.config.domains);

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
    const { enabled, updateInterval } = this.config.ckan;
    if (enabled && updateInterval > 0) {
      // schedule a refresh
      sleep(updateInterval * 60 * 1000).then(() => this.refresh());
      log.info("scheduled new update in", updateInterval, "minutes");
    }
  }

  async fetch(format) {
    //format = format.toLowerCase();
    const options = {
      url: this.config.ckan.url,
      json: true,
      timeout: 1000 * 60,
      qs: {
        sort: "id",
        filter: "dataset",
        includes: "distributions",
        limit: this.config.ckan.rowsPerRequest,
        facets: JSON.stringify({ format: [format] }),
        page: 0,
      },
    };

    const domains = new Set();
    const { maxErrorCount } = this.config.ckan;
    let errorCount = 0;
    let error = null;

    while (true) {
      const before = new Date().getTime();
      try {
        const body = await request(options);
        logRequest(options, new Date().getTime() - before);
        // reset the error count
        if (errorCount > 0) errorCount = 0;
        extractDomains(body, format, domains);
        if (body.result.count > (options.qs.page + 1) * options.qs.limit) {
          options.qs.page++;
        } else {
          return { results: domains, error };
        }
      } catch (err) {
        logRequest(options, new Date().getTime() - before);
        if (++errorCount >= maxErrorCount) {
          // the search for JSON fails for page 61 reproducible, so
          // just skip this page instead of aborting completely
          // as we have no body, we can't check if this is the last
          // page just find out by trying
          log.warn(`Too many errors: ${errorCount}! Skipping to next page`);
          error = err;
          options.qs.page++;
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
