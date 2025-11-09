/**
 * Script to update user plan
 * Usage: node scripts/update-user-plan.js <email> <plan>
 */

require('dotenv').config();
const { getPrismaClient } = require('../db/index');

async function updateUserPlan(email, plan) {
  const prisma = getPrismaClient();
  
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }
    
    console.log(`📋 Found user: ${user.username} (${user.email})`);
    console.log(`   Current plan: ${user.plan || 'free'}`);
    
    // Update plan
    const updated = await prisma.user.update({
      where: { email },
      data: { plan },
    });
    
    console.log(`✅ Updated user plan to: ${updated.plan}`);
    console.log(`   User ID: ${updated.id}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating user plan:', error);
    process.exit(1);
  }
}

// Get command line arguments
const email = process.argv[2];
const plan = process.argv[3];

if (!email || !plan) {
  console.error('Usage: node scripts/update-user-plan.js <email> <plan>');
  console.error('Example: node scripts/update-user-plan.js user@example.com pro');
  process.exit(1);
}

const validPlans = ['free', 'pro', 'power', 'enterprise'];
if (!validPlans.includes(plan.toLowerCase())) {
  console.error(`❌ Invalid plan. Must be one of: ${validPlans.join(', ')}`);
  process.exit(1);
}

updateUserPlan(email, plan.toLowerCase());

