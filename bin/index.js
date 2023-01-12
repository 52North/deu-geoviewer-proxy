#!/usr/bin/env node

import { isMaster } from "cluster";
import * as workers from "../lib/workers/index.js";

workers[isMaster ? "master" : process.env.WORKER_TYPE]();
