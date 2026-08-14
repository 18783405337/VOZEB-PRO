#!/usr/bin/env node

/**
 * Canvas Integration - Complete Migration Runner
 *
 * 运行所有画布功能整合的数据库迁移脚本
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 迁移顺序
const MIGRATIONS = [
    {
        name: '001_create_canvas_drawing_tables',
        description: 'Drawing 节点 - Excalidraw/Tldraw 绘图系统',
    },
    {
        name: '002_create_canvas_script_tables',
        description: 'Script 节点 - Tiptap 富文本编辑器',
    },
    {
        name: '002_create_canvas_skill_tables',
        description: 'Skill 节点 - AI 技能模板系统',
    },
    {
        name: '002_add_storyboard_tables',
        description: 'Storyboard 系统 - 17+ 列分镜表格',
        path: '../web/scripts/migrations/002-add-storyboard-tables.sql',
    },
    {
        name: '003_create_canvas_director3d_tables',
        description: '3D Director - 3D 场景管理',
    },
];

console.log('🚀 Canvas Integration - Migration Runner\n');
console.log('准备运行以下迁移:\n');

MIGRATIONS.forEach((migration, index) => {
    console.log(`  ${index + 1}. ${migration.name}`);
    console.log(`     ${migration.description}\n`);
});

console.log('⚠️  注意事项:');
console.log('  1. 确保已备份数据库');
console.log('  2. 确保数据库连接配置正确');
console.log('  3. 按顺序执行迁移');
console.log('  4. 如果某个迁移失败，后续迁移将不会执行\n');

console.log('📝 执行步骤:');
console.log('  1. 连接到数据库');
console.log('  2. 执行每个 .up.sql 文件');
console.log('  3. 记录执行结果\n');

// 生成 SQL 执行命令
console.log('💻 手动执行命令 (PostgreSQL):');
console.log('');

const migrationDir = join(__dirname, '../web/src/lib/server/database/migrations');

MIGRATIONS.forEach((migration, index) => {
    const sqlFile = migration.path || `${migrationDir}/${migration.name}.up.sql`;
    console.log(`-- ${index + 1}. ${migration.description}`);
    console.log(`psql -d your_database -f "${sqlFile}"`);
    console.log('');
});

console.log('✅ 迁移完成后验证:');
console.log('');
console.log('psql -d your_database -c "\\dt canvas_*"');
console.log('');

console.log('📊 预期创建的表:');
const tables = [
    'canvas_drawing_documents',
    'canvas_drawing_versions',
    'canvas_script_documents',
    'canvas_script_versions',
    'canvas_skill_documents',
    'canvas_skill_templates',
    'canvas_storyboard_data',
    'canvas_storyboard_scenes',
    'canvas_storyboard_versions',
    'canvas_director3d_scenes',
    'canvas_director3d_versions',
];

tables.forEach((table, i) => {
    console.log(`  ${i + 1}. ${table}`);
});

console.log('\n✨ 迁移脚本准备完成！');
