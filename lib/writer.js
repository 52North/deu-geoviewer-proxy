import { writeFileSync, writeFile } from "fs";
import { resolve } from "path";
import { createLogger } from "./logging.js";
const log = createLogger("writer")

function write(filename, json, sync) {
  const abs = resolve(filename);
  log.info("trying to store file at", abs);
  if (sync) {
    try {
      writeFileSync(filename, JSON.stringify(json, null, 4));
      log.info("The file was saved to " + abs);
    } catch (e) {
      log.warn(e);
    }
  } else {
    writeFile(filename, JSON.stringify(json, null, 4), function (err) {
      if (err) {
        log.warn(err);
        return;
      }

      log.info("The file was saved to " + abs);
    });
  }
}

const _write = write;
export { _write as write };
