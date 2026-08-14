/**
 * Database Migration Runner
 *
 * 运行 Canvas Drawing 数据库迁移
 */

import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/lib/server/db";

/**
 * 运行 UP migration
 */
export async function runDrawingMigrationUp() {
    const sql = readFileSync(
        join(process.cwd(), "src/lib/server/database/migrations/001_create_canvas_drawing_tables.up.sql"),
        "utf-8"
    );

    try {
        await db.query(sql);
        console.log("✅ Canvas Drawing tables created successfully");
        return true;
    } catch (error) {
        console.error("❌ Failed to create Canvas Drawing tables:", error);
        throw error;
    }
}

/**
 * 运行 DOWN migration
 */
export async function runDrawingMigrationDown() {
    const sql = readFileSync(
        join(process.cwd(), "src/lib/server/database/migrations/001_create_canvas_drawing_tables.down.sql"),
        "utf-8"
    );

    try {
        await db.query(sql);
        console.log("✅ Canvas Drawing tables dropped successfully");
        return true;
    } catch (error) {
        console.error("❌ Failed to drop Canvas Drawing tables:", error);
        throw error;
    }
}

/**
 * 检查表是否存在
 */
export async function checkDrawingTablesExist(): Promise<boolean> {
    try {
        const result = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'canvas_drawing_documents'
            );
        `);
        return result.rows[0].exists;
    } catch (error) {
        console.error("Failed to check tables:", error);
        return false;
    }
}
