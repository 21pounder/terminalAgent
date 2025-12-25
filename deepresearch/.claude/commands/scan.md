# /scan - 扫描项目

扫描当前项目，分析代码结构和潜在问题。

## 使用方式

```
/scan              # 全量扫描
/scan --quick      # 快速扫描（仅核心文件）
/scan src/         # 扫描指定目录
```

## 执行流程

1. **Reader Agent** 读取项目结构和关键文件
2. **Coordinator Agent** 分配分析任务
3. **Coder Agent** 检查代码质量
4. **Reviewer Agent** 汇总发现的问题

## 输出

扫描结果保存到 `data/findings.json`，包含：
- 代码质量问题
- 潜在 bug
- 安全隐患
- 性能优化建议
- TODO/FIXME 未处理项
