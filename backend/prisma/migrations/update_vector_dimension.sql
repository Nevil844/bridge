-- Update embedding vector dimension from 1536 to 1024 for Titan v2
ALTER TABLE memory_vectors 
ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024);
