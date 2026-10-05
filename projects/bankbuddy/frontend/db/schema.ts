import { sql } from 'drizzle-orm';
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const decisions = sqliteTable('decisions', { id: text('id').primaryKey(), targetId: text('target_id'), status: text('status').notNull(), note: text('note').notNull().default(''), updatedAt: text('updated_at').notNull(), action: text('action').notNull().default('edit'), proposedEdit: text('proposed_edit').notNull().default('{}') }, table => [uniqueIndex('unique_confirmed_target').on(table.targetId).where(sql`${table.status} = 'confirmed'`)]);
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
