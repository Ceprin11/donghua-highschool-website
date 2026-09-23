# Base44 独立化迁移

运行架构、数据路径和命令见 README.md。数据草稿与发布规则见 docs/ARCHITECTURE.md。

现有 base44/entities 仅保留原始 Schema 作为离线参考。运行时不调用 Base44 API，不需要平台账号或 token。没有从平台恢复实际数据库或媒体。

本轮文件映射与替换记录见 docs/REFACTOR_SUMMARY.md。实际通过、失败和未测试项目见 docs/TEST_REPORT.md。
