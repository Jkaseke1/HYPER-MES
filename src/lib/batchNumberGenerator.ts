import { supabase } from './supabase';

/**
 * Generates auto-incrementing batch numbers with audit trail
 * Format: PREFIX-YYYY-NNNNNN (e.g., DSP-2026-000001, BATCH-2026-000001)
 */

/**
 * Preview the next batch number WITHOUT incrementing the sequence in database.
 * This is used when opening modal forms so opening and closing forms without submitting
 * does NOT consume or skip sequence numbers.
 */
export async function peekBatchNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    let tableName = 'production_orders';
    let colName = 'batch_number';
    if (prefix === 'DSP') { tableName = 'dispatch_orders'; colName = 'dispatch_number'; }
    else if (prefix === 'GRN') { tableName = 'goods_received_notes'; colName = 'grn_number'; }
    else if (prefix === 'PO') { tableName = 'purchase_orders'; colName = 'po_number'; }
    else if (prefix === 'WB') { tableName = 'weigh_bridge_tickets'; colName = 'ticket_no'; }

    // Query the latest actual record inserted in DB
    const { data } = await supabase
      .from(tableName)
      .select(colName)
      .like(colName, `${prefix}-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(10);

    let maxSeq = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        const val = (row as any)[colName] || '';
        const parts = val.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const sequenceNumber = String(nextSeq).padStart(6, '0');
    return `${prefix}-${year}-${sequenceNumber}`;
  } catch (err) {
    console.error(`Error peeking batch number for ${prefix}:`, err);
    return `${prefix}-${year}-000001`;
  }
}

/**
 * Get the next sequential batch number for a given prefix.
 * This should ONLY be called when ACTUALLY SUBMITTING / SAVING a record into the database!
 */
export async function generateBatchNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  
  try {
    let tableName = 'production_orders';
    let colName = 'batch_number';
    if (prefix === 'DSP') { tableName = 'dispatch_orders'; colName = 'dispatch_number'; }
    else if (prefix === 'GRN') { tableName = 'goods_received_notes'; colName = 'grn_number'; }
    else if (prefix === 'PO') { tableName = 'purchase_orders'; colName = 'po_number'; }
    else if (prefix === 'WB') { tableName = 'weigh_bridge_tickets'; colName = 'ticket_no'; }

    const { data: maxRows } = await supabase
      .from(tableName)
      .select(colName)
      .like(colName, `${prefix}-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(10);

    let maxSeq = 0;
    if (maxRows && maxRows.length > 0) {
      for (const row of maxRows) {
        const val = (row as any)[colName] || '';
        const parts = val.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;

    // Sync/update batch_sequences table in Supabase
    await supabase
      .from('batch_sequences')
      .upsert(
        { prefix, year, next_sequence: nextSeq + 1, updated_at: new Date().toISOString() },
        { onConflict: 'prefix,year' }
      );

    const sequenceNumber = String(nextSeq).padStart(6, '0');
    return `${prefix}-${year}-${sequenceNumber}`;
  } catch (err) {
    console.error('Batch number generation failed:', err);
    return `${prefix}-${year}-${Date.now().toString(36).toUpperCase()}`;
  }
}

export async function peekProductionBatchNumber(): Promise<string> {
  return peekBatchNumber('BATCH');
}

export async function generateProductionBatchNumber(): Promise<string> {
  return generateBatchNumber('BATCH');
}

export async function peekDispatchNumber(): Promise<string> {
  return peekBatchNumber('DSP');
}

export async function generateDispatchNumber(): Promise<string> {
  return generateBatchNumber('DSP');
}

export async function peekGRNNumber(): Promise<string> {
  return peekBatchNumber('GRN');
}

export async function generateGRNNumber(): Promise<string> {
  return generateBatchNumber('GRN');
}

export async function generatePONumber(): Promise<string> {
  return generateBatchNumber('PO');
}
