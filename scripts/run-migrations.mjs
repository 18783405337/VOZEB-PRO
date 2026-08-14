#!/usr/bin/env node
/**
 * Migration Runner Script
 *
 * 按正确顺序运行所有数据库迁移
 *
 * Usage:
 *   node scripts/run-migrations.mjs up      # 运行所有 up migrations
 *   node scripts/run-migrations.mjs down    # 运行所有 down migrations
 *   node scripts/run-migrations.mjs status  # 检查迁移状态
 */

import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

const { Pool } = pg;

// 数据库连接
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.VOZEB_PRO_DATABASE_SSL === "1" ? { rejectUnauthorized: false } : false,
});

// 迁移配置（按执行顺序）
const MIGRATIONS = [
    {
        id: "001",
        name: "create_canvas_drawing_tables",
        description: "Canvas Drawing 文档和版本表",
    },
    {
        id: "002",
        name: "create_canvas_script_tables",
        description: "Canvas Script 文档和版本表",
    },
    {
        id: "003",
        name: "create_canvas_skill_tables",
        description: "Canvas Skill 文档和执行历史表",
    },
];

/**
 * 创建迁移记录表
 */
async function createMigrationTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    `;

    try {
        await pool.query(sql);
        console.log("✅ Migration tracking table ready");
    } catch (error) {
        console.error("❌ Failed to create migration table:", error);
        throw error;
    }
}

/**
 * 检查迁移是否已应用
 */
async function isMigrationApplied(id) {
    const result = await pool.query(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE id = $1)",
        [id]
    );
    return result.rows[0].exists;
}

/**
 * 记录迁移
 */
async function recordMigration(migration) {
    await pool.query(
        "INSERT INTO schema_migrations (id, name, description) VALUES ($1, $2, $3)",
        [migration.id, migration.name, migration.description]
    );
}

/**
 * 删除迁移记录
 */
async function removeMigrationRecord(id) {
    await pool.query("DELETE FROM schema_migrations WHERE id = $1", [id]);
}

/**
 * 运行单个 UP migration
 */
async function runMigrationUp(migration) {
    const filePath = join(
        process.cwd(),
        "src/lib/server/database/migrations",
        `${migration.id}_${migration.name}.up.sql`
    );

    try {
        const sql = readFileSync(filePath, "utf-8");
        await pool.query(sql);
        await recordMigration(migration);
        console.log(`✅ Applied: ${migration.id}_${migration.name}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed: ${migration.id}_${migration.name}`, error);
        throw error;
    }
}

/**
 * 运行单个 DOWN migration
 */
async function runMigrationDown(migration) {
    const filePath = join(
        process.cwd(),
        "src/lib/server/database/migrations",
        `${migration.id}_${migration.name}.down.sql`
    );

    try {
        const sql = readFileSync(filePath, "utf-8");
        await pool.query(sql);
        await removeMigrationRecord(migration.id);
        console.log(`✅ Rolled back: ${migration.id}_${migration.name}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to rollback: ${migration.id}_${migration.name}`, error);
        throw error;
    }
}

/**
 * 运行所有 UP migrations
 */
async function migrateUp() {
    console.log("\n🚀 Running UP migrations...\n");

    for (const migration of MIGRATIONS) {
        const applied = await isMigrationApplied(migration.id);
        if (applied) {
            console.log(`⏭️  Skipped: ${migration.id}_${migration.name} (already applied)`);
        } else {
            await runMigrationUp(migration);
        }
    }

    console.log("\n✅ All migrations completed!\n");
}

/**
 * 运行所有 DOWN migrations（反向顺序）
 */
async function migrateDown() {
    console.log("\n🔄 Running DOWN migrations...\n");

    const reversed = [...MIGRATIONS].reverse();

    for (const migration of reversed) {
        const applied = await isMigrationApplied(migration.id);
        if (!applied) {
            console.log(`⏭️  Skipped: ${migration.id}_${migration.name} (not applied)`);
        } else {
            await runMigrationDown(migration);
        }
    }

    console.log("\n✅ All rollbacks completed!\n");
}

/**
 * 显示迁移状态
 */
async function showStatus() {
    console.log("\n📊 Migration Status:\n");

    for (const migration of MIGRATIONS) {
        const applied = await isMigrationApplied(migration.id);
        const status = applied ? "✅ Applied" : "⏸️  Pending";
        console.log(`${status}  ${migration.id}_${migration.name}`);
        console.log(`          ${migration.description}\n`);
    }
}

/**
 * Main
 */
async function main() {
    const command = process.argv[2];

    if (!command || !["up", "down", "status"].includes(command)) {
        console.log(`
Usage:
  node scripts/run-migrations.mjs up      # Run all pending migrations
  node scripts/run-migrations.mjs down    # Rollback all applied migrations
  node scripts/run-migrations.mjs status  # Show migration status
        `);
        process.exit(1);
    }

    try {
        await createMigrationTable();

        switch (command) {
            case "up":
                await migrateUp();
                break;
            case "down":
                await migrateDown();
                break;
            case "status":
                await showStatus();
                break;
        }
    } catch (error) {
        console.error("\n❌ Migration failed:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
