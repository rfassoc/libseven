const chalk = require('chalk');

const identity = x => x;
const LogLevel = {
  TRACE: {
    index: 0,
    prefix: chalk.gray.dim('TRACE'),
    style: chalk.gray,
    output: console.log,
  },
  DEBUG: {
    index: 1,
    prefix: chalk.gray('DEBUG'),
    style: identity,
    output: console.log,
  },
  INFO: {
    index: 2,
    prefix: chalk.blueBright(' INFO'),
    style: identity,
    output: console.log,
  },
  WARN: {
    index: 3,
    prefix: chalk.gray.yellow(' WARN'),
    style: identity,
    output: console.log,
  },
  ERROR: {
    index: 4,
    prefix: chalk.redBright.bold('ERROR'),
    style: chalk.redBright,
    output: console.error,
  },
};

class Logger {
  constructor() {
    this.level = LogLevel.INFO;
  }

  setLevel(level) {
    this.level = level;
  }

  trace(...args) {
    this.print(LogLevel.TRACE, ...args);
  }

  debug(...args) {
    this.print(LogLevel.DEBUG, ...args);
  }

  info(...args) {
    this.print(LogLevel.INFO, ...args);
  }

  warn(...args) {
    this.print(LogLevel.WARN, ...args);
  }

  error(...args) {
    this.print(LogLevel.ERROR, ...args);
  }

  print(level, ...args) {
    if (level.index >= this.level.index) {
      const timestamp = new Date().toISOString();
      const before = `${timestamp} ${level.prefix} --`;
      level.output.call(console, before, ...args);
    }
  }
}

module.exports = {logs: new Logger(), LogLevel};