/**
 * Backfill Credits Script
 * Calculates and updates credits for existing token usage records
 * 
 * Usage: node scripts/backfill-credits.js
 */

const { getPrismaClient } = require('../db/index');
const { calculateCredits } = require('../config/creditSystem');

async function backfillCredits() {
  const prisma = getPrismaClient();
  
  try {
    console.log('🔄 Starting credit backfill...\n');
    
    // Get all token usage records (we'll calculate credits for all)
    // First check if creditsUsed column exists by trying a simple query
    const records = await prisma.tokenUsage.findMany({
      take: 1,
    });
    
    if (records.length === 0) {
      console.log('✅ No records found in database');
      return;
    }
    
    // Check if creditsUsed exists by checking the first record
    const hasCreditsField = 'creditsUsed' in records[0];
    
    if (!hasCreditsField) {
      console.log('❌ creditsUsed column does not exist in database!');
      console.log('   Please run: npx prisma db push');
      console.log('   Or apply the SQL migration: prisma/migrations/004_add_credits_used.sql');
      return;
    }
    
    // Get all records that need credits calculated
    const allRecords = await prisma.tokenUsage.findMany();
    
    // Filter records that need credits (zero or null)
    const recordsToUpdate = allRecords.filter(r => {
      const credits = r.creditsUsed ? parseFloat(r.creditsUsed.toString()) : 0;
      return credits === 0;
    });
    
    console.log(`📊 Found ${allRecords.length} total records`);
    console.log(`📊 ${recordsToUpdate.length} records need credits calculated\n`);
    
    if (recordsToUpdate.length === 0) {
      console.log('✅ All records already have credits calculated!');
      return;
    }
    
    let updated = 0;
    let errors = 0;
    
    for (const record of recordsToUpdate) {
      try {
        // Calculate credits for this record
        const credits = calculateCredits(
          record.model || 'claude-3-5-sonnet',
          record.inputTokens || 0,
          record.outputTokens || 0
        );
        
        // Update the record
        await prisma.tokenUsage.update({
          where: { id: record.id },
          data: { creditsUsed: credits },
        });
        
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`  ✓ Updated ${updated}/${records.length} records...`);
        }
      } catch (error) {
        console.error(`  ❌ Error updating record ${record.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Backfill complete!`);
    console.log(`   Updated: ${updated} records`);
    console.log(`   Errors: ${errors} records`);
    
    // Show sample of updated records
    const sample = await prisma.tokenUsage.findMany({
      where: {
        creditsUsed: { gt: 0 },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });
    
    if (sample.length > 0) {
      console.log(`\n📋 Sample of updated records:`);
      sample.forEach(r => {
        console.log(`   Model: ${r.model || 'unknown'}, Input: ${r.inputTokens}, Output: ${r.outputTokens}, Credits: ${r.creditsUsed}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  backfillCredits()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { backfillCredits };

