/** @format */

import { Logger } from "pastel-logger";
import sourceMapSupport from "source-map-support";

sourceMapSupport.install();

const logger = new Logger();
logger.log("PASS !");
