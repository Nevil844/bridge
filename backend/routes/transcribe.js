const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const appConfig = require('../config/app');

const router = express.Router();
const upload = multer({ dest: appConfig.uploads.dest });

// Note: WebSocket routes must be defined on the app, not the router
// The /stream endpoint is defined in server.js after expressWs is initialized

/**
 * Helper function to convert stream to string
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Authenticate token and return user ID
 */
async function authenticateTranscribeToken(token) {
  const integrationService = require('../db/services/integration');
  const { getPrismaClient } = require('../db/index');
  
  if (!token || token.trim() === '') {
    throw new Error('Token is required');
  }

  const prisma = getPrismaClient();
  const integrations = await prisma.userIntegration.findMany({
    where: {
      provider: 'google-auth',
      isActive: true,
    },
  });

  let authenticatedUserId = null;
  
  for (const integration of integrations) {
    try {
      const decryptedCredentials = integrationService.decrypt(integration.credentials);
      if (decryptedCredentials && typeof decryptedCredentials === 'object' && decryptedCredentials.accessToken === token) {
        authenticatedUserId = integration.userId;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!authenticatedUserId) {
    throw new Error('Invalid or expired token');
  }

  return authenticatedUserId;
}

/**
 * WebSocket transcription endpoint
 * Collects audio chunks and processes them using AWS Transcribe batch API (supports m4a format)
 * NOTE: This is defined in server.js because express-ws requires app.ws(), not router.ws()
 * The WebSocket route is: /api/transcribe/stream
 */
function setupTranscribeWebSocket(app) {
  app.ws('/api/transcribe/stream', (ws, req) => {
    let userId = null;
    let authenticated = false;
    let audioQueue = [];
    let isStreaming = false;

    const region = process.env.AWS_REGION || 'ap-south-1'; // Mumbai region
    const clientConfig = {
      region: region,
    };
    
    console.log(`🌍 Using AWS region: ${region} (for both S3 and Transcribe)`);
    
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    // Cleanup function
    const cleanup = () => {
      isStreaming = false;
      audioQueue = [];
    };

    ws.on('message', async (message) => {
      try {
        // Handle binary audio data (m4a chunks from Expo Audio)
        if (Buffer.isBuffer(message) || message instanceof ArrayBuffer) {
          if (!authenticated || !isStreaming) {
            console.warn('⚠️ Received audio chunk but not authenticated or streaming not started');
            return;
          }

          const audioChunk = Buffer.isBuffer(message) ? message : Buffer.from(message);
          
          if (audioChunk.length === 0) {
            return;
          }

          // Log audio chunk receipt (first few chunks and periodically)
          const totalChunks = audioQueue.length + 1;
          if (totalChunks <= 5 || totalChunks % 20 === 0) {
            console.log(`📥 Received audio chunk #${totalChunks}: ${audioChunk.length} bytes (queue size: ${audioQueue.length})`);
          }

          // Collect audio chunks for batch transcription (supports m4a format)
          audioQueue.push(audioChunk);
          return;
        }

        // Handle JSON messages (control messages)
        const data = JSON.parse(message.toString());
        
        // First message must be authentication
        if (!authenticated) {
          if (data.type === 'auth' && data.token) {
            try {
              userId = await authenticateTranscribeToken(data.token);
              authenticated = true;
              console.log(`✅ Transcription WebSocket authenticated for user ${userId}`);
              ws.send(JSON.stringify({ type: 'authenticated', userId }));
            } catch (error) {
              console.error('❌ Transcription authentication failed:', error);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication failed: ' + error.message,
              }));
              ws.close();
            }
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Authentication required. Send { type: "auth", token: "..." } first.',
            }));
            ws.close();
          }
          return;
        }
        
        if (data.type === 'start') {
          if (isStreaming) {
            console.warn('⚠️ Transcription already started');
            return;
          }

          console.log('🎤 Starting transcription (will use batch API for m4a files)...');
          isStreaming = true;
          audioQueue = [];

        } else if (data.type === 'stop') {
          console.log('🛑 Stopping transcription stream...');
          isStreaming = false;
          
          if (audioQueue.length > 0 && ws.readyState === 1) {
            console.log(`📦 Processing ${audioQueue.length} audio chunks using batch transcription...`);
            
            try {
              const totalSize = audioQueue.reduce((sum, chunk) => sum + chunk.length, 0);
              const combinedAudio = Buffer.concat(audioQueue, totalSize);
              console.log(`✅ Combined audio: ${totalSize} bytes`);
              
              const tempFilePath = `${appConfig.uploads.dest}/transcribe-${Date.now()}-${Math.random().toString(36).substring(7)}.m4a`;
              fs.writeFileSync(tempFilePath, combinedAudio);
              console.log(`💾 Saved audio to temp file: ${tempFilePath}`);
              
              const s3Bucket = process.env.AWS_TRANSCRIBE_S3_BUCKET || process.env.AWS_S3_BUCKET;
              
              if (!s3Bucket) {
                throw new Error('S3 bucket not configured. Set AWS_TRANSCRIBE_S3_BUCKET in .env');
              }
              
              const TranscribeClient = require('@aws-sdk/client-transcribe').TranscribeClient;
              const S3Client = require('@aws-sdk/client-s3').S3Client;
              const { StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
              const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
              
              const s3ClientConfig = {
                region: region,
              };
              
              if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                s3ClientConfig.credentials = {
                  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                };
              }
              
              const s3Client = new S3Client(s3ClientConfig);
              const batchTranscribeClient = new TranscribeClient(clientConfig);
              
              // Upload to S3
              const jobName = `transcribe-ws-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              const s3Key = `transcriptions/${jobName}.m4a`;
              
              await s3Client.send(new PutObjectCommand({
                Bucket: s3Bucket,
                Key: s3Key,
                Body: combinedAudio,
                ContentType: 'audio/m4a',
              }));
              
              console.log(`✅ Uploaded audio to S3: s3://${s3Bucket}/${s3Key}`);
              
              const s3Uri = `s3://${s3Bucket}/${s3Key}`;
              const startCommand = new StartTranscriptionJobCommand({
                TranscriptionJobName: jobName,
                Media: { MediaFileUri: s3Uri },
                MediaFormat: 'mp4',
                LanguageCode: data.languageCode || 'en-US',
              });
              
              await batchTranscribeClient.send(startCommand);
              console.log(`✅ Started batch transcription job: ${jobName}`);
              
              let jobStatus = 'IN_PROGRESS';
              let attempts = 0;
              const maxAttempts = 30;
              
              while (jobStatus === 'IN_PROGRESS' && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const getCommand = new GetTranscriptionJobCommand({ TranscriptionJobName: jobName });
                const jobResult = await batchTranscribeClient.send(getCommand);
                jobStatus = jobResult.TranscriptionJob?.TranscriptionJobStatus || 'IN_PROGRESS';
                attempts++;
                
                if (jobStatus === 'COMPLETED') {
                  const transcriptUri = jobResult.TranscriptionJob?.Transcript?.TranscriptFileUri;
                  if (!transcriptUri) {
                    throw new Error('Transcription completed but no transcript URI found');
                  }
                  
                  const https = require('https');
                  const transcriptResponse = await new Promise((resolve, reject) => {
                    https.get(transcriptUri, (response) => {
                      if (response.statusCode !== 200) {
                        reject(new Error(`Failed to fetch transcript: ${response.statusCode}`));
                        return;
                      }
                      
                      let data = '';
                      response.on('data', (chunk) => { data += chunk; });
                      response.on('end', () => {
                        try {
                          const transcriptJson = JSON.parse(data);
                          resolve(transcriptJson);
                        } catch (e) {
                          reject(new Error('Failed to parse transcript JSON: ' + e.message));
                        }
                      });
                    }).on('error', (error) => {
                      reject(error);
                    });
                    
                    setTimeout(() => reject(new Error('Request timeout')), 10000);
                  });
                  
                  const transcriptText = transcriptResponse.results?.transcripts?.[0]?.transcript || '';
                  
                  if (transcriptText.trim()) {
                    console.log(`✅ Batch transcription completed: "${transcriptText}"`);
                    
                    if (ws.readyState === 1) {
                      console.log(`📤 Sending transcript to client: "${transcriptText}"`);
                      ws.send(JSON.stringify({
                        type: 'transcript',
                        text: transcriptText,
                        isPartial: false,
                      }));
                      await new Promise(resolve => setTimeout(resolve, 100));
                    } else {
                      console.warn('⚠️ WebSocket is not open, cannot send transcript');
                    }
                  } else {
                    console.warn('⚠️ Batch transcription returned empty transcript');
                  }
                  
                  // Cleanup S3 file
                  try {
                    await s3Client.send(new DeleteObjectCommand({
                      Bucket: s3Bucket,
                      Key: s3Key,
                    }));
                  } catch (cleanupError) {
                    console.warn('⚠️ Failed to cleanup S3 file:', cleanupError);
                  }
                  
                  break;
                } else if (jobStatus === 'FAILED') {
                  const failureReason = jobResult.TranscriptionJob?.FailureReason || 'Unknown error';
                  throw new Error(`Transcription job failed: ${failureReason}`);
                }
              }
              
              if (jobStatus !== 'COMPLETED') {
                throw new Error('Transcription job timed out');
              }
              
              // Cleanup temp file
              try {
                fs.unlinkSync(tempFilePath);
              } catch (e) {
                console.warn('⚠️ Failed to delete temp file:', e);
              }
              
            } catch (error) {
              console.error('❌ Batch transcription error:', error);
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Transcription failed: ' + error.message,
                }));
              }
            }
          }
          
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'stopped' }));
          }
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(JSON.stringify({
            type: 'error',
            message: error.message,
          }));
        }
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      cleanup();
    });

    ws.on('close', () => {
      console.log('🔌 Transcription WebSocket closed, cleaning up...');
      cleanup();
    });
  });
}

/**
 * Fast batch transcription endpoint (for complete audio files)
 * Uses optimized batch processing - faster than real-time for pre-recorded audio
 */
router.post('/batch', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('🎵 Transcribing audio file (batch mode):', req.file.filename);

    const region = process.env.AWS_REGION || 'ap-south-1';
    const s3Bucket = process.env.AWS_TRANSCRIBE_S3_BUCKET || process.env.AWS_S3_BUCKET;
    
    const clientConfig = {
      region: region,
    };
    
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    const transcribeClient = new TranscribeClient(clientConfig);
    const s3Client = new S3Client(clientConfig);

    if (!s3Bucket) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'S3 bucket not configured',
        message: 'Amazon Transcribe requires an S3 bucket for batch transcription.',
        setup: {
          step1: 'Create an S3 bucket: aws s3 mb s3://your-transcribe-bucket',
          step2: 'Add to backend/.env: AWS_TRANSCRIBE_S3_BUCKET=your-transcribe-bucket',
          step3: 'Restart the backend server',
        }
      });
    }

    // Upload to S3
    const jobName = `transcribe-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const s3Key = `transcriptions/${jobName}.m4a`;
    const audioData = fs.readFileSync(req.file.path);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: audioData,
      ContentType: 'audio/m4a',
    }));

    console.log(`✅ Uploaded audio to S3: s3://${s3Bucket}/${s3Key}`);

    // Start transcription job
    const s3Uri = `s3://${s3Bucket}/${s3Key}`;
    const startCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: s3Uri },
      MediaFormat: 'mp4',
      LanguageCode: 'en-US',
    });

    await transcribeClient.send(startCommand);
    console.log(`✅ Started transcription job: ${jobName}`);

    // Poll for job completion (max 60 seconds)
    let jobStatus = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 60;

    while (jobStatus === 'IN_PROGRESS' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const getCommand = new GetTranscriptionJobCommand({ TranscriptionJobName: jobName });
      const jobResult = await transcribeClient.send(getCommand);
      jobStatus = jobResult.TranscriptionJob?.TranscriptionJobStatus || 'IN_PROGRESS';
      attempts++;
      
      if (jobStatus === 'COMPLETED') {
        const transcriptUri = jobResult.TranscriptionJob?.Transcript?.TranscriptFileUri;
        if (!transcriptUri) {
          throw new Error('Transcription completed but no transcript URI found');
        }
        
        console.log(`📋 Transcript URI received: ${transcriptUri}`);

        // Parse transcript URI - Transcribe stores in its own bucket
        // Format: https://s3.region.amazonaws.com/bucket/key
        let transcriptBucket, transcriptKey;
        
        // Extract from URL: https://s3.region.amazonaws.com/bucket/key
        const urlMatch = transcriptUri.match(/https?:\/\/s3[^\/]*\.amazonaws\.com\/([^\/]+)\/(.+)/) ||
                        transcriptUri.match(/https?:\/\/([^\/]+)\.s3[^\/]*\.amazonaws\.com\/(.+)/);
        
        if (urlMatch) {
          if (urlMatch[1].includes('amazonaws')) {
            // Format: https://s3.region.amazonaws.com/bucket/key
            transcriptBucket = urlMatch[2];
            transcriptKey = urlMatch[3] || urlMatch[2].split('/').slice(1).join('/');
          } else {
            // Format: https://bucket.s3.region.amazonaws.com/key
            transcriptBucket = urlMatch[1];
            transcriptKey = urlMatch[2];
          }
        } else if (transcriptUri.includes('s3://')) {
          const s3Match = transcriptUri.match(/s3:\/\/([^\/]+)\/(.+)/);
          if (s3Match) {
            transcriptBucket = s3Match[1];
            transcriptKey = s3Match[2];
          }
        } else {
          // Fallback: parse from path
          const pathMatch = transcriptUri.match(/\.com\/([^?]+)/);
          if (pathMatch) {
            const parts = pathMatch[1].split('/');
            transcriptBucket = parts[0];
            transcriptKey = parts.slice(1).join('/');
          }
        }
        
        if (transcriptKey) {
          transcriptKey = transcriptKey.split('?')[0];
        }
        
        // Try to fetch transcript via HTTPS first (transcript URI is usually an HTTPS URL)
        let transcribedText;
        
        if (transcriptUri.startsWith('https://')) {
          try {
            console.log(`📥 Fetching transcript via HTTPS: ${transcriptUri}`);
            const https = require('https');
            const http = require('http');
            const url = require('url');
            
            const transcriptData = await new Promise((resolve, reject) => {
              const parsedUrl = new URL(transcriptUri);
              const client = parsedUrl.protocol === 'https:' ? https : http;
              
              const request = client.get(transcriptUri, (response) => {
                if (response.statusCode !== 200) {
                  reject(new Error(`Failed to fetch transcript: ${response.statusCode}`));
                  return;
                }
                
                let data = '';
                response.on('data', (chunk) => {
                  data += chunk;
                });
                response.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    reject(new Error('Failed to parse transcript JSON: ' + e.message));
                  }
                });
              });
              
              request.on('error', (error) => {
                reject(error);
              });
              
              request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
              });
            });
            
            transcribedText = transcriptData.results.transcripts[0].transcript;
            console.log('✅ Successfully fetched transcript via HTTPS');
          } catch (httpsError) {
            console.warn('⚠️ HTTPS fetch failed, trying S3:', httpsError.message);
            
            // Fallback to S3 if HTTPS fails
            if (!transcriptBucket || !transcriptKey) {
              console.error('Failed to parse transcript URI:', transcriptUri);
              throw new Error('Unable to parse transcript URI: ' + transcriptUri);
            }
            
            console.log(`📥 Downloading transcript from S3: s3://${transcriptBucket}/${transcriptKey}`);
            
            const getObjectCommand = new GetObjectCommand({
              Bucket: transcriptBucket,
              Key: transcriptKey,
            });
            
            const transcriptResponse = await s3Client.send(getObjectCommand);
            const transcriptBody = await streamToString(transcriptResponse.Body);
            const transcriptData = JSON.parse(transcriptBody);
            
            transcribedText = transcriptData.results.transcripts[0].transcript;
          }
        } else {
          // S3 URI or other format
          if (!transcriptBucket || !transcriptKey) {
            console.error('Failed to parse transcript URI:', transcriptUri);
            throw new Error('Unable to parse transcript URI: ' + transcriptUri);
          }
          
          console.log(`📥 Downloading transcript from S3: s3://${transcriptBucket}/${transcriptKey}`);
          
          const getObjectCommand = new GetObjectCommand({
            Bucket: transcriptBucket,
            Key: transcriptKey,
          });
          
          const transcriptResponse = await s3Client.send(getObjectCommand);
          const transcriptBody = await streamToString(transcriptResponse.Body);
          const transcriptData = JSON.parse(transcriptBody);
          
          transcribedText = transcriptData.results.transcripts[0].transcript;
        }

        // Clean up
        try {
          await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
          console.log(`✅ Cleaned up audio file from S3`);
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup S3 file:', cleanupError);
        }

        fs.unlinkSync(req.file.path);

        console.log('✅ Transcription result:', transcribedText);
        res.json({ text: transcribedText });
        return;
      } else if (jobStatus === 'FAILED') {
        throw new Error(jobResult.TranscriptionJob?.FailureReason || 'Transcription job failed');
      }
    }

    if (jobStatus !== 'COMPLETED') {
      throw new Error('Transcription job timed out');
    }
  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
});


module.exports = { router, setupTranscribeWebSocket };
