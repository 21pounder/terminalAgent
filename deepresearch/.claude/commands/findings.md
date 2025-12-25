# /findings - 查看发现

查看最近一次扫描发现的问题。

## 使用方式

```
/findings              # 查看所有发现
/findings --critical   # 仅显示严重问题
/findings --type=bug   # 按类型过滤
```

## 问题类型

- `bug` - 潜在 bug
- `security` - 安全隐患
- `performance` - 性能问题
- `style` - 代码风格
- `todo` - 未完成项

## 输出格式

```
[严重程度] 文件:行号 - 问题描述
  建议: 修复建议
```
