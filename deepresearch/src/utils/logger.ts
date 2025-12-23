/**
 * 日志输出模块 - 彩色终端输出
 */

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

export const logger = {
  info(msg: string): void {
    console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`);
  },

  success(msg: string): void {
    console.log(`${colors.green}[OK]${colors.reset} ${msg}`);
  },

  warn(msg: string): void {
    console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`);
  },

  error(msg: string): void {
    console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`);
  },

  debug(msg: string): void {
    if (process.env.DEBUG) {
      console.log(`${colors.gray}[DEBUG]${colors.reset} ${msg}`);
    }
  },

  skill(name: string, msg: string): void {
    console.log(`${colors.magenta}[/${name}]${colors.reset} ${msg}`);
  },

  tool(name: string, msg: string): void {
    console.log(`${colors.cyan}[${name}]${colors.reset} ${msg}`);
  },

  output(msg: string): void {
    console.log(msg);
  },

  divider(): void {
    console.log(`${colors.dim}${"─".repeat(50)}${colors.reset}`);
  },
};
