import { supabase } from './supabase';

/**
 * Generates auto-incrementing batch numbers with audit trail
 * Format: PREFIX-YYYY-NNNNNN (e.g., DSP-2026-000001, BATCH-2026-000001)
 */

/**
 * Get the next sequential batch number for a given prefix
 * Uses a database sequence table to ensure uniqueness and prevent gaps
 */
export async function generateBatchNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  
  try {
    // Call RPC function to get next sequence number atomically
    const { data, error } = await supabase.rpc('get_next_batch_sequence', {
      p_prefix: prefix,
      p_year: year
    });

    if (error) {
      console.error('Error generating batch number:', error);
      // Fallback to timestamp-based generation if RPC fails
      return `${prefix}-${year}-${Date.now().toString(36).toUpperCase()}`;
    }

    if (!data) {
      throw new Error('No sequence number returned');
    }

    // Format: PREFIX-YYYY-NNNNNN (6-digit zero-padded sequence)
    const sequenceNumber = String(data).padStart(6, '0');
    return `${prefix}-${year}-${sequenceNumber}`;
  } catch (err) {
    console.error('Batch number generation failed:', err);
    // Fallback to timestamp-based generation
    return `${prefix}-${year}-${Date.now().toString(36).toUpperCase()}`;
  }
}

/**
 * Dispatch Order batch number generator
 */
export async function generateDispatchNumber(): Promise<string> {
  return generateBatchNumber('DSP');
}

/**
 * Production Order batch number generator
 */
export async function generateProductionBatchNumber(): Promise<string> {
  return generateBatchNumber('BATCH');
}

/**
 * Goods Received Note batch number generator
 */
export async function generateGRNNumber(): Promise<string> {
  return generateBatchNumber('GRN');
}

/**
 * Purchase Order batch number generator
 */
export async function generatePONumber(): Promise<string> {
  return generateBatchNumber('PO');
}
