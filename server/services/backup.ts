import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import * as schema from '../db/schema';

export const backupDatabase = async (): Promise<{ filePath: string; fileName: string; format: 'sql' | 'json'; sizeBytes: number }> => {
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    const fileName = `backup-${date}.sql`;
    const filePath = path.join(backupDir, fileName);
    const command = `pg_dump "${process.env.DATABASE_URL}" -F c -f "${filePath}"`;

    try {
      await new Promise<string>((resolve, reject) => {
        exec(command, (error, _stdout, stderr) => {
          if (error) {
            console.warn(`pg_dump failed (${error.message}), falling back to structured JSON backup`);
            return reject(error);
          }
          if (stderr) console.warn(`pg_dump stderr: ${stderr}`);
          resolve(filePath);
        });
      });
      const stats = fs.statSync(filePath);
      return { filePath, fileName, format: 'sql', sizeBytes: stats.size };
    } catch {
      // Fall through to JSON snapshot backup.
    }
  }

  const jsonFileName = `backup-${date}.json`;
  const jsonFilePath = path.join(backupDir, jsonFileName);

  const [
    settingsRows,
    farmersRows,
    driversRows,
    originsRows,
    invoicesRows,
    formulasRows,
    formulaItemsRows,
    productionRows,
    batchesRows,
    adjustmentsRows,
    transactionsRows,
    logsRows,
    productsRows,
    categoriesRows,
  ] = await Promise.all([
    db.select().from(schema.settings),
    db.select().from(schema.farmers),
    db.select().from(schema.drivers),
    db.select().from(schema.origins),
    db.select().from(schema.invoices),
    db.select().from(schema.formulas),
    db.select().from(schema.formula_items),
    db.select().from(schema.production_records),
    db.select().from(schema.batches),
    db.select().from(schema.inventory_adjustments),
    db.select().from(schema.inventory_transactions),
    db.select().from(schema.logs),
    db.select().from(schema.products),
    db.select().from(schema.product_categories),
  ]);

  const snapshot = {
    version: '2.0.0',
    createdAt: new Date().toISOString(),
    tables: {
      settings: settingsRows,
      farmers: farmersRows,
      drivers: driversRows,
      origins: originsRows,
      invoices: invoicesRows,
      formulas: formulasRows,
      formula_items: formulaItemsRows,
      production_records: productionRows,
      batches: batchesRows,
      inventory_adjustments: adjustmentsRows,
      inventory_transactions: transactionsRows,
      logs: logsRows,
      products: productsRows,
      product_categories: categoriesRows,
    },
  };

  fs.writeFileSync(jsonFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  const stats = fs.statSync(jsonFilePath);
  return { filePath: jsonFilePath, fileName: jsonFileName, format: 'json', sizeBytes: stats.size };
};

export const restoreDatabase = async (backupData: any): Promise<{ restoredTables: string[] }> => {
  const tables = backupData.tables || backupData;
  const restoredTables: string[] = [];

  await db.transaction(async (tx: any) => {
    if (Array.isArray(tables.settings) && tables.settings.length > 0) {
      for (const row of tables.settings) {
        await tx.insert(schema.settings).values(row).onConflictDoUpdate({ target: schema.settings.id, set: row });
      }
      restoredTables.push('settings');
    }
    if (Array.isArray(tables.farmers) && tables.farmers.length > 0) {
      for (const row of tables.farmers) {
        await tx.insert(schema.farmers).values(row).onConflictDoUpdate({ target: schema.farmers.id, set: row });
      }
      restoredTables.push('farmers');
    }
    if (Array.isArray(tables.drivers) && tables.drivers.length > 0) {
      for (const row of tables.drivers) {
        await tx.insert(schema.drivers).values(row).onConflictDoUpdate({ target: schema.drivers.id, set: row });
      }
      restoredTables.push('drivers');
    }
    if (Array.isArray(tables.origins) && tables.origins.length > 0) {
      for (const row of tables.origins) {
        await tx.insert(schema.origins).values(row).onConflictDoUpdate({ target: schema.origins.id, set: row });
      }
      restoredTables.push('origins');
    }
    if (Array.isArray(tables.invoices) && tables.invoices.length > 0) {
      for (const row of tables.invoices) {
        await tx.insert(schema.invoices).values(row).onConflictDoUpdate({ target: schema.invoices.id, set: row });
      }
      restoredTables.push('invoices');
    }
    if (Array.isArray(tables.formulas) && tables.formulas.length > 0) {
      for (const row of tables.formulas) {
        await tx.insert(schema.formulas).values(row).onConflictDoUpdate({ target: schema.formulas.id, set: row });
      }
      restoredTables.push('formulas');
    }
    if (Array.isArray(tables.production_records) && tables.production_records.length > 0) {
      for (const row of tables.production_records) {
        await tx.insert(schema.production_records).values(row).onConflictDoUpdate({ target: schema.production_records.id, set: row });
      }
      restoredTables.push('production_records');
    }
    if (Array.isArray(tables.inventory_adjustments) && tables.inventory_adjustments.length > 0) {
      for (const row of tables.inventory_adjustments) {
        await tx.insert(schema.inventory_adjustments).values(row).onConflictDoUpdate({ target: schema.inventory_adjustments.id, set: row });
      }
      restoredTables.push('inventory_adjustments');
    }
    if (Array.isArray(tables.inventory_transactions) && tables.inventory_transactions.length > 0) {
      for (const row of tables.inventory_transactions) {
        await tx.insert(schema.inventory_transactions).values(row).onConflictDoUpdate({ target: schema.inventory_transactions.id, set: row });
      }
      restoredTables.push('inventory_transactions');
    }
  });

  return { restoredTables };
};
