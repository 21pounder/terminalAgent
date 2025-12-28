/**
 * CLI Theme - 配色方案
 *
 * 设计灵感：Dexter 终端 UI
 * 主色调：深色终端背景 + 白/灰文字
 * 点缀色：金黄色 (#E8B849) 和蒂芙尼蓝 (#5BC0BE) - 占比 < 20%
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
  white: "\x1b[97m",                    // 亮白色
  gray: "\x1b[90m",                     // 灰色
  darkGray: "\x1b[38;5;242m",           // 深灰色
  lightGray: "\x1b[38;5;250m",          // 浅灰色

  // 点缀色 - 金黄色 (#E8B849) - 温暖的金色
  accent: "\x1b[38;2;232;184;73m",      // 主金黄色
  accentDim: "\x1b[38;2;180;140;50m",   // 暗金黄色
  accentBg: "\x1b[48;2;232;184;73m",    // 金黄色背景

  // 点缀色 - 蒂芙尼蓝 (#5BC0BE) - 优雅的青绿色
  tiffany: "\x1b[38;2;91;192;190m",     // 主蒂芙尼蓝
  tiffanyDim: "\x1b[38;2;70;150;148m",  // 暗蒂芙尼蓝
  tiffanyBg: "\x1b[48;2;91;192;190m",   // 蓝色背景

  // 功能色
  success: "\x1b[38;2;80;200;120m",     // 清新绿色
  error: "\x1b[38;2;230;100;100m",      // 柔和红色
  warning: "\x1b[38;2;232;184;73m",     // 金黄色（同 accent）
  info: "\x1b[38;2;91;192;190m",        // 蒂芙尼蓝（同 tiffany）

  // 背景色
  bgBlack: "\x1b[40m",
  bgDark: "\x1b[48;5;235m",
  bgSelected: "\x1b[48;5;238m",
  bgHighlight: "\x1b[48;5;236m",        // 高亮背景
};

// 图标 - Unicode 字符
export const icons = {
  prompt: ">>",              // 输入提示符
  command: ">",              // 命令前缀
  folder: "+",               // 文件夹
  file: "-",                 // 文件
  arrow: "->",               // 箭头
  arrowLeft: "<-",           // 左箭头
  check: "v",                // 成功 ✓
  cross: "x",                // 失败 ✗
  dot: "*",                  // 点
  chevronRight: ">",         // 右箭头
  chevronDown: "v",          // 下箭头
  search: "?",               // 搜索
  sparkle: "*",              // 星号
  lightning: "!",            // 闪电
  task: ">",                 // 任务
  thinking: ":",             // 思考中
  completed: "v",            // 完成
  pending: "+",              // 待处理
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

/**
 * ASCII Art Logo - Terminal Agent
 */
export const logo = `
   _____                 _             __   ___                    __
  /__   \\ ___  _ __ _ __ (_)_ __   __ _| |  / _ \\  __ _  ___  _ __ | |_
    / /\\// _ \\| '__| '_ \\| | '_ \\ / _\` | | / /_\\// _\` |/ _ \\| '_ \\| __|
   / /  |  __/| |  | | | | | | | | (_| | |/ /_\\\\| (_| |  __/| | | | |_
   \\/    \\___||_|  |_| |_|_|_| |_|\\__,_|_|\\____/ \\__,_|\\___||_| |_|\\__|
`.trim();

/**
 * 简化版 Logo
 */
export const logoSimple = `
 ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗
 ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║
    ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║
    ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║
    ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
    ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
`.trim();

/**
 * 极简 Logo - 更容易渲染
 */
export const logoMinimal = `
    _   ___ ___ _  _ _____
   /_\\ / __| __| \\| |_   _|
  / _ \\ (_ | _|| .\` | | |
 /_/ \\_\\___|___|_|\\_| |_|
`.trim();

/**
 * 创建任务框
 */
export function taskBox(title: string, items: string[], width: number = 60): string {
  const lines: string[] = [];
  const innerWidth = width - 4;

  // 顶部边框 + 标题
  const titlePart = ` ${title} `;
  const remainingWidth = innerWidth - titlePart.length;
  const leftDash = Math.floor(remainingWidth / 2);
  const rightDash = remainingWidth - leftDash;

  lines.push(
    fmt(borders.topLeft, theme.tiffany) +
    fmt(borders.horizontal.repeat(leftDash), theme.tiffany) +
    fmt(titlePart, theme.accent, theme.bold) +
    fmt(borders.horizontal.repeat(rightDash), theme.tiffany) +
    fmt(borders.topRight, theme.tiffany)
  );

  // 内容
  for (const item of items) {
    const paddedItem = item.padEnd(innerWidth);
    lines.push(
      fmt(borders.vertical, theme.tiffany) +
      " " + paddedItem.slice(0, innerWidth) + " " +
      fmt(borders.vertical, theme.tiffany)
    );
  }

  // 底部边框
  lines.push(
    fmt(borders.bottomLeft, theme.tiffany) +
    fmt(borders.horizontal.repeat(innerWidth + 2), theme.tiffany) +
    fmt(borders.bottomRight, theme.tiffany)
  );

  return lines.join("\n");
}

/**
 * 创建状态行
 */
export function statusLine(status: "pending" | "in_progress" | "completed" | "error", text: string): string {
  const statusIcons: Record<string, { icon: string; color: string }> = {
    pending: { icon: "+", color: theme.gray },
    in_progress: { icon: ":", color: theme.accent },
    completed: { icon: "v", color: theme.success },
    error: { icon: "x", color: theme.error },
  };

  const { icon, color } = statusIcons[status];
  return fmt(` ${icon} `, color) + text;
}

/**
 * 创建进度指示器
 */
export function progressIndicator(current: number, total: number, width: number = 20): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "=".repeat(filled) + "-".repeat(empty);
  return fmt("[", theme.gray) + fmt(bar, theme.tiffany) + fmt("]", theme.gray);
}

/**
 * 欢迎横幅
 */
export function welcomeBanner(version: string): string {
  const width = 56;
  const inner = width - 2;
  const lines: string[] = [];

  // 顶部边框
  lines.push(
    fmt(borders.topLeft, theme.tiffany) +
    fmt(borders.horizontal.repeat(inner), theme.tiffany) +
    fmt(borders.topRight, theme.tiffany)
  );

  // 标题行
  const title = "Welcome to Terminal Agent";
  const titlePad = Math.floor((inner - title.length) / 2);
  lines.push(
    fmt(borders.vertical, theme.tiffany) +
    " ".repeat(titlePad) +
    fmt(title, theme.accent) +
    " ".repeat(inner - titlePad - title.length) +
    fmt(borders.vertical, theme.tiffany)
  );

  // 底部边框
  lines.push(
    fmt(borders.bottomLeft, theme.tiffany) +
    fmt(borders.horizontal.repeat(inner), theme.tiffany) +
    fmt(borders.bottomRight, theme.tiffany)
  );

  return lines.join("\n");
}
