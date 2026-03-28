// bridgeWorker.js - Main bridge worker that polls sync_log and processes events
// Coordinates all auto event handlers and runs continuously

const { supabase } = require('../lib/supabase');
const { 
  processPendingGoodsReceiptEvents 
} = require('./goodsReceiptAuto');
const { 
  processPendingGoodsIssueEvents 
} = require('./goodsIssueAuto');
const { 
  processPendingBatchCompletionEvents 
} = require('./batchCompleteAuto');
const { 
  processPendingDispatchEvents 
} = require('./dispatchAuto');

// Configuration
const POLL_INTERVAL = 30000; // 30 seconds
const BATCH_SIZE = 10; // Process 10 events at a time per type
const MAX_RETRIES = 3; // Maximum retry attempts
const RETRY_DELAY = 300000; // 5 minutes between retries

class BridgeWorker {
  constructor() {
    this.isRunning = false;
    this.processingEvents = new Set(); // Track events being processed to avoid duplicates
    this.stats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      retryCount: 0,
      startTime: new Date()
    };
  }

  // Main processing loop
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Bridge worker is already running');
      return;
    }

    console.log('🚀 Starting HYPER MES - Sage Pastel Bridge Worker');
    console.log(`📊 Poll interval: ${POLL_INTERVAL / 1000} seconds`);
    console.log(`🔄 Batch size: ${BATCH_SIZE} events per type`);
    
    this.isRunning = true;
    this.stats.startTime = new Date();

    // Main processing loop
    while (this.isRunning) {
      try {
        await this.processAllEventTypes();
        await this.printStats();
        await this.sleep(POLL_INTERVAL);
      } catch (error) {
        console.error('❌ Error in main processing loop:', error);
        await this.sleep(5000); // Wait 5 seconds before retrying
      }
    }
  }

  // Process all event types
  async processAllEventTypes() {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Processing all event types...');
      
      // Process each event type in parallel
      await Promise.all([
        this.processEventType('grn_confirmed', processPendingGoodsReceiptEvents),
        this.processEventType('materials_issued', processPendingGoodsIssueEvents),
        this.processEventType('production_completed', processPendingBatchCompletionEvents),
        this.processEventType('dispatch_delivered', processPendingDispatchEvents)
      ]);

      const duration = Date.now() - startTime;
      console.log(`✅ All event types processed in ${duration}ms`);

    } catch (error) {
      console.error('❌ Error processing event types:', error);
    }
  }

  // Process a specific event type with error handling
  async processEventType(eventType, processor) {
    try {
      console.log(`📦 Processing ${eventType} events...`);
      await processor();
      console.log(`✅ ${eventType} events processed successfully`);
    } catch (error) {
      console.error(`❌ Error processing ${eventType} events:`, error);
      this.stats.errorCount++;
    }
  }

  // Handle retry events
  async processRetryEvents() {
    try {
      console.log('🔄 Checking for retry events...');
      
      const { data: retryEvents, error } = await supabase
        .from('sync_log')
        .select('*')
        .eq('status', 'retry')
        .lt('retry_count', MAX_RETRIES)
        .lte('next_retry_at', new Date().toISOString())
        .order('next_retry_at', { ascending: true })
        .limit(BATCH_SIZE);

      if (error) {
        throw new Error(`Failed to fetch retry events: ${error.message}`);
      }

      if (!retryEvents || retryEvents.length === 0) {
        console.log('✅ No retry events ready for processing');
        return;
      }

      console.log(`🔄 Found ${retryEvents.length} retry events to process`);

      // Reset retry events to pending for reprocessing
      const { error: resetError } = await supabase
        .from('sync_log')
        .update({ 
          status: 'pending', 
          next_retry_at: null,
          updated_at: new Date().toISOString()
        })
        .in('id', retryEvents.map(e => e.id));

      if (resetError) {
        throw new Error(`Failed to reset retry events: ${resetError.message}`);
      }

      this.stats.retryCount += retryEvents.length;
      console.log(`✅ Reset ${retryEvents.length} events to pending status`);

    } catch (error) {
      console.error('❌ Error processing retry events:', error);
    }
  }

  // Clean up old successful events (optional - for log management)
  async cleanupOldEvents() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep 7 days of logs

      const { error } = await supabase
        .from('sync_log')
        .delete()
        .eq('status', 'success')
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        console.error('⚠️  Error cleaning up old events:', error.message);
      } else {
        console.log('🧹 Cleaned up old successful events');
      }

    } catch (error) {
      console.error('❌ Error in cleanup:', error);
    }
  }

  // Print worker statistics
  async printStats() {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    // Get current sync log stats
    const { data: logStats } = await supabase
      .from('sync_log')
      .select('status')
      .then(({ data }) => {
        const stats = data?.reduce((acc, log) => {
          acc[log.status] = (acc[log.status] || 0) + 1;
          return acc;
        }, {}) || {};
        return stats;
      });

    console.log('\n📊 Bridge Worker Statistics:');
    console.log(`⏱️  Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    console.log(`✅ Success: ${this.stats.successCount}`);
    console.log(`❌ Errors: ${this.stats.errorCount}`);
    console.log(`🔄 Retries: ${this.stats.retryCount}`);
    console.log(`📋 Queue Status:`, logStats || 'No events');
    console.log('─'.repeat(50));
  }

  // Graceful shutdown
  async stop() {
    console.log('🛑 Stopping bridge worker...');
    this.isRunning = false;
    
    // Wait for current processing to complete
    while (this.processingEvents.size > 0) {
      console.log(`⏳ Waiting for ${this.processingEvents.size} events to complete...`);
      await this.sleep(1000);
    }
    
    await this.printStats();
    console.log('✅ Bridge worker stopped gracefully');
  }

  // Utility function for sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check endpoint
  getHealthStatus() {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.stats.startTime.getTime(),
      stats: this.stats,
      activeEvents: this.processingEvents.size
    };
  }
}

// Create and start the worker
const worker = new BridgeWorker();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📡 Received SIGINT, shutting down gracefully...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📡 Received SIGTERM, shutting down gracefully...');
  await worker.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  worker.stop().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the worker
if (require.main === module) {
  console.log('🌟 HYPER MES - Sage Pastel Bridge Worker v1.0');
  console.log('🔗 Connecting to Supabase...');
  
  // Test database connection
  supabase.from('sync_log').select('count').then(() => {
    console.log('✅ Database connection successful');
    worker.start();
  }).catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });
}

// Export for testing
module.exports = BridgeWorker;
