/**
 * CLI Theme - 配色方案
 *
 * 主色调：终端原生色
 * 点缀色：黄色 (#F1C40F) 和蒂芙尼蓝 (#81D8D0)
 * 亮色占比：20-30%
 */

// ANSI 256 色和 RGB 支持
export const theme = {
  // 基础色
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // 主要颜色 - 终端原生
  white: "\x1b[37m",
  gray: "\x1b[90m",
  darkGray: "\x1b[38;5;240m",

  // 点缀色 - 黄色 (#F1C40F)
  accent: "\x1b[38;2;241;196;15m",      // 主黄色
  accentDim: "\x1b[38;2;200;160;10m",   // 暗黄色
  accentBg: "\x1b[48;2;241;196;15m",    // 黄色背景

  // 点缀色 - 蒂芙尼蓝 (#81D8D0)
  tiffany: "\x1b[38;2;129;216;208m",    // 主蒂芙尼蓝
  tiffanyDim: "\x1b[38;2;90;170;165m",  // 暗蒂芙尼蓝
  tiffanyBg: "\x1b[48;2;129;216;208m",  // 蓝色背景

  // 功能色
  success: "\x1b[38;2;46;204;113m",     // 绿色
  error: "\x1b[38;2;231;76;60m",        // 红色
  warning: "\x1b[38;2;241;196;15m",     // 黄色（同 accent）
  info: "\x1b[38;2;129;216;208m",       // 蒂芙尼蓝（同 tiffany）

  // 背景色
  bgBlack: "\x1b[40m",
  bgDark: "\x1b[48;5;235m",
  bgSelected: "\x1b[48;5;238m",
};

// 图标 - 使用纯 ASCII 字符确保对齐
export const icons = {
  command: ">",
  folder: "[D]",
  file: "[F]",
  arrow: "->",
  arrowLeft: "<-",
  check: "[OK]",
  cross: "[X]",
  dot: "*",
  chevronRight: ">",
  chevronDown: "v",
  search: "[?]",
  sparkle: "*",
  lightning: "!",
};

// 边框字符
export const borders = {
  top: "─",
  bottom: "─",
  left: "│",
  right: "│",
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
};

/**
 * 格式化文本
 */
export function fmt(text: string, ...styles: string[]): string {
  if (styles.length === 0) return text;
  return styles.join("") + text + theme.reset;
}

/**
 * 创建带边框的框
 */
export function box(content: string[], width: number = 50): string {
  const lines: string[] = [];
  const innerWidth = width - 2;

  lines.push(fmt(borders.topLeft + borders.horizontal.repeat(innerWidth) + borders.topRight, theme.tiffany));

  for (const line of content) {
    const paddedLine = line.padEnd(innerWidth);
    lines.push(fmt(borders.vertical, theme.tiffany) + paddedLine + fmt(borders.vertical, theme.tiffany));
  }

  lines.push(fmt(borders.bottomLeft + borders.horizontal.repeat(innerWidth) + borders.bottomRight, theme.tiffany));

  return lines.join("\n");
}

/**
 * 高亮文本（用于选中项）
 */
export function highlight(text: string): string {
  return fmt(text, theme.bgSelected, theme.accent, theme.bold);
}

/**
 * 暗淡文本（用于非活动项）
 */
export function dim(text: string): string {
  return fmt(text, theme.dim, theme.gray);
}

/**
 * 清除当前行
 */
export function clearLine(): void {
  process.stdout.write("\x1b[2K\r");
}

/**
 * 移动光标
 */
export function moveCursor(rows: number, cols: number = 0): void {
  if (rows < 0) {
    process.stdout.write(`\x1b[${-rows}A`);
  } else if (rows > 0) {
    process.stdout.write(`\x1b[${rows}B`);
  }
  if (cols < 0) {
    process.stdout.write(`\x1b[${-cols}D`);
  } else if (cols > 0) {
    process.stdout.write(`\x1b[${cols}C`);
  }
}

/**
 * 隐藏光标
 */
export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

/**
 * 显示光标
 */
export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

/**
 * 保存光标位置
 */
export function saveCursor(): void {
  process.stdout.write("\x1b[s");
}

/**
 * 恢复光标位置
 */
export function restoreCursor(): void {
  process.stdout.write("\x1b[u");
}

/**
 * 计算字符串的可见宽度（排除 ANSI 转义码）
 */
export function visibleLength(str: string): number {
  // 移除所有 ANSI 转义序列
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, "");
  return stripped.length;
}

/**
 * 按可见宽度填充字符串
 */
export function padEndVisible(str: string, width: number, char: string = " "): string {
  const visible = visibleLength(str);
  if (visible >= width) return str;
  return str + char.repeat(width - visible);
}
