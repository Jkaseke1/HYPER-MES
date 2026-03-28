// lib/supabase.js - Supabase client for bridge
// Handles communication with HYPER MES Supabase database

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://appyuqxetlphuxfybmus.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('sync_log')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('✅ Supabase connection successful');
    return { success: true, connectedAt: new Date().toISOString() };
    
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    return { success: false, error: error.message, testedAt: new Date().toISOString() };
  }
}

module.exports = { supabase, testConnection };
