import extend from "extend";
import { readFileSync } from "fs";

const defaultOptions = {
  logging: { level: "info" },
  proxy: {
    port: 9090,
    cors: {
      allowCredentials: true,
      maxAge: 86400,
      allowedHeaders: [
        "accept",
        "accept-charset",
        "accept-encoding",
        "accept-language",
        "authorization",
        "content-length",
        "content-type",
        "host",
        "origin",
        "proxy-connection",
        "referer",
        "user-agent",
        "x-requested-with",
      ],
      allowedMethods: ["HEAD", "POST", "GET", "PUT", "PATCH", "DELETE"],
    },
  },
  whitelist: {
    ckan: {
      enabled: false,
      url: "http://demo.ckan.org",
      updateInterval: 60,
      rowsPerRequest: 1000,
      maxErrorCount: 10,
    },
    formats: [],
    domains: [],
  },
};

const readConfig = (file) => {
  const options = {};
  extend(true, options, defaultOptions);
  try {
    const data = readFileSync(file, { encoding: "utf8" });
    if (data) extend(true, options, JSON.parse(data));
  } catch (e) {
    // ignore
  }
  return options;
};

const getPath = () => {
  if (process.argv.length > 2) {
    return process.argv[2];
  } else {
    return process.cwd() + "/config.json";
  }
};

export default readConfig(getPath());
