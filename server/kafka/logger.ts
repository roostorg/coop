/* eslint-disable no-console */
import util from 'util';
import { logLevel, type logCreator } from 'kafkajs';

import { assertUnreachable } from '../utils/misc.js';

// This is almost a carbon copy of the default logger in kafkajs, but it uses
// util.inspect instead of JSON.stringify to avoid errors when logging circular
// objects. See:
// https://github.com/tulios/kafkajs/blob/master/src/loggers/console.js
// https://github.com/tulios/kafkajs/issues/975
const logCreator: logCreator =
  () =>
  ({ namespace, level, label, log }) => {
    const prefix = namespace ? `[${namespace}] ` : '';
    const message = util.inspect({
      level: label,
      ...log,
      message: `${prefix}${log.message}`,
    });
    switch (level) {
      case logLevel.INFO:
        return console.info(message);
      case logLevel.ERROR:
        return console.error(message);
      case logLevel.WARN:
        return console.warn(message);
      case logLevel.DEBUG:
        return console.log(message);
      case logLevel.NOTHING:
        return;
      default:
        assertUnreachable(level);
    }
  };

export default logCreator;
