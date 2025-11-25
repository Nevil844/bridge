/**
 * Database Client - Prisma Singleton
 * Bridge AI - PostgreSQL + pgvector
 */

const { PrismaClient } = require('@prisma/client');

// Singleton instance
let prisma;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Graceful shutdown
    process.on('beforeExit', async () => {
      await prisma.$disconnect();
    });
  }
  return prisma;
}

module.exports = { getPrismaClient };

