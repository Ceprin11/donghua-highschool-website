# 数据模型

独立数据库模型与公开读取规则见 docs/ARCHITECTURE.md。数据库结构由 migrations 下的版本化 SQL 创建，业务数据保存在 DATA_DIR。

base44/entities 保留旧 Schema，仅作原字段含义的参考。
