const bunyan = require("bunyan");
const config = require("./config").logging;

const createStreamConfig = (config) => {
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

module.exports = function createLogger(category) {
  return category ? main.child({ category: category }) : main;
};
