import { createServer, request } from "http";
import { request as _request } from "https";
import { parse, format } from "url";
import { hostname } from "os";
import Whitelist from "./whitelist.js";
import { createLogger } from "./logging.js";
const log = createLogger("proxy")

class Proxy {
  constructor(config) {
    this.whitelist = new Whitelist();
    this.config = config;
    this.allowedHeaders = config.cors.allowedHeaders.join(", ");
    this.allowedMethods = config.cors.allowedMethods.join(", ");
    this.server = createServer((req, res) => this.handle(req, res));
  }

  getTarget(req) {
    const target = parse(req.url).query;
    if (!target) return null;
    return parse(decodeURIComponent(target));
  }

  start(callback) {
    return this.server.listen(
      this.config.port,
      this.config.hostname,
      this.config.backlog,
      callback
    );
  }

  accepts(target) {
    let { host } = target;
    if (!host) { return false; }
    host = host.replace(/:[0-9]+$/, "");
    if (this.whitelist.contains(host)) {
      return true;
    }
    while (host.indexOf(".") > 0) {
      host = host.substring(host.indexOf(".") + 1)
      if (this.whitelist.contains(host)) {
        return true;
      }
    }
    return false;
  }

  addXFFHeader(headers, req) {
    var address;
    if (req.connection?.remoteAddress) {
      address = req.connection.remoteAddress;
    } else if (req.socket?.remoteAddress) {
      address = req.socket.remoteAddress;
    } else if (req.connection?.socket) {
      address = req.connection.socket;
    }
    this.appendOrCreateHeader(headers, "x-forwarded-for", address);
  }

  addCorsHeaders(headers, req) {
    headers["access-control-allow-origin"] = req.headers.origin || "*";
    headers["access-control-expose-headers"] = Object.keys(headers).join(",");
    return headers;
  }

  addViaHeader(headers) {
    this.appendOrCreateHeader(headers, "via", hostname());
  }

  appendOrCreateHeader(headers, name, value) {
    if (value)
      headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }

  createRequest(target, req, cb) {
    const options = {};
    options.headers = req.headers;
    delete options.headers.connection;
    delete options.headers.upgrade;
    delete options.headers.host;

    if (options.headers.authorization) {
      delete options.headers.authorization;
    }

    this.addViaHeader(options.headers);
    this.addXFFHeader(options.headers, req);
    options.method = req.method;

    //dirty workaround, cause ESRI JS API patched dojo/request/xhr...
    if (options.method?.toString().toLowerCase() === "get") {
      if (options.headers["content-type"]) {
        delete options.headers["content-type"];
      }
    }

    log.trace("Request options: " + JSON.stringify(options));
    if (target.protocol === "https:") {
      return _request(format(target), options, cb);
    } else {
      return request(format(target), options, cb);
    }
  }

  proxyRequest(target, req, res) {
    log.trace("Request Headers: " + JSON.stringify(req.headers));
    var preq = this.createRequest(target, req, (pres) => {
      this.addViaHeader(pres.headers);
      //this.addXFFHeader(pres.headers, preq);
      this.addCorsHeaders(pres.headers, req);
      if (pres.headers.location) {
        const redirectLocation = pres.headers.location;
        //send this to the whitelist, should be in it
        var domain = parse(redirectLocation);
        if (domain && domain.host) {
          domain = domain.host.toLowerCase();
          process.send({
            cmd: "whitelist.newRedirectDomain",
            domain: domain,
          });
        }

        pres.headers.location = `${parse(req.url).pathname
          }?${encodeURIComponent(redirectLocation)}`;
      }

      if (pres.headers["x-frame-options"]) {
        delete pres.headers["x-frame-options"];
      }

      log.trace("Response Headers: " + JSON.stringify(pres.headers));
      res.writeHead(pres.statusCode, pres.headers);
      log.debug("Piping response");
      pres.on("error", () => res.end());
      pres.pipe(res);
    });

    preq.on("error", (e) => this.sendServerError(req, res, e)); // calls res.end()
    req.on("close", () => preq?.destroy());
    res.on("close", () => preq?.destroy());
    log.debug("Piping request");
    req.pipe(preq);
  }

  rejectRequest(target, req, res) {
    res.statusCode = 403;
    const headers = this.addCorsHeaders({}, req);
    for (const key in headers) {
      res.setHeader(key, headers[key]);
    }
    res.end(`Not whitelisted domain name: ${target.host}\n`, "utf8");
  }

  checkForCorsPreflight(req, res) {
    if (req.method !== "OPTIONS" || !req.headers.origin) {
      return false;
    }
    log.debug("Handling CORS preflight request");
    res.writeHead(200, {
      "access-control-allow-origin": req.headers.origin || "*",
      "access-control-max-age": this.config.cors.maxAge,
      "access-control-allow-credentials": this.config.cors.allowCredentials,
      "access-control-allow-methods":
        req.headers["access-control-request-method"] || this.allowedMethods,
      "access-control-allow-headers":
        req.headers["access-control-request-headers"] || this.allowedHeaders,
    });
    res.end();
    return true;
  }

  handle(req, res) {
    try {
      log.debug({ url: req.url }, "Incoming request");
      var target = this.getTarget(req);
      if (!target) {
        res.statusCode = 400;
        res.end();
        return;
      }
      if (!this.checkForCorsPreflight(req, res)) {
        if (this.accepts(target)) {
          log.debug("Domain %s is whitelisted", target.host);
          this.proxyRequest(target, req, res);
        } else {
          log.debug("Domain %s is not whitelisted", target.host);
          this.rejectRequest(target, req, res);
        }
      }
    } catch (e) {
      this.sendServerError(req, res, e);
    }
  }

  sendServerError(req, res, e) {
    const headers = this.addCorsHeaders({}, req);
    for (const key in headers) {
      res.setHeader(key, headers[key]);
    }
    log.error(e);
    res.statusCode = 500;
    res.end();
  }
}

export default Proxy;
