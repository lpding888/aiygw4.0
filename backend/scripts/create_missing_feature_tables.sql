-- 创建缺失的 feature 相关表

-- 1. feature_configurations
CREATE TABLE IF NOT EXISTS `feature_configurations` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `feature_id` varchar(36) NOT NULL COMMENT '功能ID',
  `config_key` varchar(100) NOT NULL COMMENT '配置键',
  `config_value` text COMMENT '配置值',
  `data_type` enum('string','number','boolean','json','array') DEFAULT 'string' COMMENT '数据类型',
  `description` text COMMENT '配置描述',
  `is_required` tinyint(1) DEFAULT 0 COMMENT '是否必需',
  `is_sensitive` tinyint(1) DEFAULT 0 COMMENT '是否敏感信息',
  `validation_rules` json COMMENT '验证规则',
  `default_value` varchar(255) COMMENT '默认值',
  `enum_values` json COMMENT '枚举值',
  `sort_order` int DEFAULT 0 COMMENT '排序',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_configurations_feature_id_config_key_unique` (`feature_id`,`config_key`),
  KEY `feature_configurations_feature_id_index` (`feature_id`),
  KEY `feature_configurations_config_key_index` (`config_key`),
  CONSTRAINT `feature_configurations_feature_id_foreign` FOREIGN KEY (`feature_id`) REFERENCES `feature_definitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. feature_permissions
CREATE TABLE IF NOT EXISTS `feature_permissions` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `feature_id` varchar(36) NOT NULL COMMENT '功能ID',
  `permission_type` enum('role','user','membership','custom') NOT NULL COMMENT '权限类型',
  `permission_value` varchar(100) NOT NULL COMMENT '权限值',
  `access_level` enum('none','read','write','admin') DEFAULT 'read' COMMENT '访问级别',
  `conditions` json COMMENT '权限条件',
  `is_granted` tinyint(1) DEFAULT 1 COMMENT '是否授权',
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  `expires_at` timestamp NULL COMMENT '过期时间',
  `granted_by` varchar(36) COMMENT '授权人',
  `notes` text COMMENT '备注',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `feature_permissions_feature_id_index` (`feature_id`),
  KEY `feature_permissions_permission_type_index` (`permission_type`),
  KEY `feature_permissions_permission_value_index` (`permission_value`),
  KEY `feature_permissions_access_level_index` (`access_level`),
  KEY `feature_permissions_expires_at_index` (`expires_at`),
  CONSTRAINT `feature_permissions_feature_id_foreign` FOREIGN KEY (`feature_id`) REFERENCES `feature_definitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. feature_usage_stats
CREATE TABLE IF NOT EXISTS `feature_usage_stats` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `feature_id` varchar(36) NOT NULL COMMENT '功能ID',
  `user_id` varchar(36) COMMENT '用户ID',
  `usage_date` date NOT NULL COMMENT '使用日期',
  `usage_count` int DEFAULT 0 COMMENT '使用次数',
  `usage_metrics` json COMMENT '使用指标',
  `total_cost` decimal(10,4) DEFAULT 0.0000 COMMENT '总成本',
  `status` enum('success','failed','partial') DEFAULT 'success' COMMENT '状态',
  `error_details` json COMMENT '错误详情',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_usage_stats_feature_id_user_id_usage_date_unique` (`feature_id`,`user_id`,`usage_date`),
  KEY `feature_usage_stats_feature_id_index` (`feature_id`),
  KEY `feature_usage_stats_user_id_index` (`user_id`),
  KEY `feature_usage_stats_usage_date_index` (`usage_date`),
  KEY `feature_usage_stats_status_index` (`status`),
  CONSTRAINT `feature_usage_stats_feature_id_foreign` FOREIGN KEY (`feature_id`) REFERENCES `feature_definitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. feature_versions
CREATE TABLE IF NOT EXISTS `feature_versions` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `feature_id` varchar(36) NOT NULL COMMENT '功能ID',
  `version` varchar(20) NOT NULL COMMENT '版本号',
  `release_type` enum('major','minor','patch','beta','alpha') NOT NULL COMMENT '发布类型',
  `changelog` text COMMENT '变更日志',
  `config_changes` json COMMENT '配置变更',
  `is_current` tinyint(1) DEFAULT 0 COMMENT '是否当前版本',
  `is_stable` tinyint(1) DEFAULT 1 COMMENT '是否稳定版',
  `released_at` timestamp NULL COMMENT '发布时间',
  `released_by` varchar(36) COMMENT '发布人',
  `compatibility_info` json COMMENT '兼容性信息',
  `migration_guide` text COMMENT '迁移指南',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_versions_feature_id_version_unique` (`feature_id`,`version`),
  KEY `feature_versions_feature_id_index` (`feature_id`),
  KEY `feature_versions_version_index` (`version`),
  KEY `feature_versions_is_current_index` (`is_current`),
  KEY `feature_versions_is_stable_index` (`is_stable`),
  KEY `feature_versions_released_at_index` (`released_at`),
  CONSTRAINT `feature_versions_feature_id_foreign` FOREIGN KEY (`feature_id`) REFERENCES `feature_definitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. feature_dependencies
CREATE TABLE IF NOT EXISTS `feature_dependencies` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `feature_id` varchar(36) NOT NULL COMMENT '功能ID',
  `depends_on_feature_id` varchar(36) NOT NULL COMMENT '依赖的功能ID',
  `dependency_type` enum('required','optional','suggested') DEFAULT 'required' COMMENT '依赖类型',
  `min_version` varchar(20) COMMENT '最低版本要求',
  `max_version` varchar(20) COMMENT '最高版本限制',
  `description` text COMMENT '依赖描述',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '是否激活',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_dependencies_feature_id_depends_on_feature_id_unique` (`feature_id`,`depends_on_feature_id`),
  KEY `feature_dependencies_feature_id_index` (`feature_id`),
  KEY `feature_dependencies_depends_on_feature_id_index` (`depends_on_feature_id`),
  CONSTRAINT `feature_dependencies_feature_id_foreign` FOREIGN KEY (`feature_id`) REFERENCES `feature_definitions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feature_dependencies_depends_on_feature_id_foreign` FOREIGN KEY (`depends_on_feature_id`) REFERENCES `feature_definitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
