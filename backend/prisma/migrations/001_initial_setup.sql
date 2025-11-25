-- ============================================
-- Migration: Initial Setup with pgvector
-- Bridge AI - Chatbot with Memory & MCP Integrations
-- ============================================

-- Enable pgvector extension for semantic embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  last_active TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_user_last_active ON conversations(user_id, last_active DESC);
CREATE INDEX idx_conversations_user_created ON conversations(user_id, created_at DESC);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- ============================================
-- TOOL CONTEXTS TABLE
-- ============================================
CREATE TABLE tool_contexts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  state JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_tool_contexts_conversation_active ON tool_contexts(conversation_id, is_active);
CREATE INDEX idx_tool_contexts_tool_active ON tool_contexts(tool_name, is_active);

-- ============================================
-- MEMORY VECTORS TABLE (with pgvector)
-- ============================================
CREATE TABLE memory_vectors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  message_id TEXT,
  embedding vector(1536) NOT NULL, -- OpenAI text-embedding-3-small/large
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_memory_vectors_user_created ON memory_vectors(user_id, created_at DESC);
CREATE INDEX idx_memory_vectors_conversation ON memory_vectors(conversation_id);

-- Create HNSW index for fast vector similarity search (cosine distance)
CREATE INDEX idx_memory_vectors_embedding ON memory_vectors 
USING hnsw (embedding vector_cosine_ops);

-- Alternative: IVFFlat index (good for smaller datasets)
-- CREATE INDEX idx_memory_vectors_embedding ON memory_vectors 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- USER INTEGRATIONS TABLE
-- ============================================
CREATE TABLE user_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credentials JSONB NOT NULL,
  metadata JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_user_integrations_user_active ON user_integrations(user_id, is_active);
CREATE INDEX idx_user_integrations_provider ON user_integrations(provider);

-- ============================================
-- TOKEN USAGE TABLE (Optional - for billing)
-- ============================================
CREATE TABLE token_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL, -- Format: "2025-01"
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, month, model)
);

CREATE INDEX idx_token_usage_user_month ON token_usage(user_id, month);

