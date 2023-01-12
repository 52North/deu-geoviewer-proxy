import * as bunyan from "bunyan";
import { default as config } from "./config.js";

const createStreamConfig = ({ logging: config }) => {
  let stream = { level: config.level };
  if (config.stream) {
    stream = { ...stream, ...config.stream };
  } else {
    stream.stream = process.stdout;
  }
  return stream;
};

const main = bunyan.createLogger({
  name: "ckan-proxy",
  src: false,
  serializers: bunyan.stdSerializers,
  streams: [createStreamConfig(config)],
});

const createLogger = (category) => {
  return category ? main.child({ category }) : main;
};

export { createLogger };
