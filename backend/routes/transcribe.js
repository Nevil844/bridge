const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
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
 * Real-time streaming transcription endpoint (WebSocket)
 * NOTE: This is defined in server.js because express-ws requires app.ws(), not router.ws()
 * The WebSocket route is: /api/transcribe/stream
 */
function setupTranscribeWebSocket(app) {
  app.ws('/api/transcribe/stream', (ws, req) => {
  const region = process.env.AWS_REGION || 'us-east-1';
  
  const clientConfig = {
    region: region,
  };
  
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  const transcribeClient = new TranscribeStreamingClient(clientConfig);
  let audioQueue = [];
  let audioQueueResolver = null;
  let isStreaming = false;
  let transcriptionPromise = null;

  // Async generator for audio chunks
  async function* audioGenerator() {
    while (isStreaming) {
      if (audioQueue.length > 0) {
        const chunk = audioQueue.shift();
        yield { AudioEvent: { AudioChunk: chunk } };
      } else {
        // Wait for next chunk
        await new Promise(resolve => {
          audioQueueResolver = resolve;
        });
      }
    }
  }

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'start') {
        console.log('🎤 Starting real-time transcription stream...');
        isStreaming = true;
        audioQueue = [];

        // Start streaming transcription
        const command = new StartStreamTranscriptionCommand({
          LanguageCode: data.languageCode || 'en-US',
          MediaSampleRateHertz: data.sampleRate || 16000,
          MediaEncoding: 'pcm',
          AudioStream: audioGenerator(),
        });

        // Handle transcription results in background
        transcriptionPromise = (async () => {
          try {
            const response = await transcribeClient.send(command);
            
            if (response.TranscriptResultStream) {
              for await (const event of response.TranscriptResultStream) {
                if (event.TranscriptEvent) {
                  const results = event.TranscriptEvent.Transcript?.Results || [];
                  results.forEach(result => {
                    if (result.Alternatives && result.Alternatives.length > 0) {
                      const transcript = result.Alternatives[0].Transcript;
                      const isPartial = result.IsPartial || false;
                      
                      ws.send(JSON.stringify({
                        type: 'transcript',
                        text: transcript,
                        isPartial: isPartial,
                      }));
                      
                      if (!isPartial) {
                        console.log('✅ Final transcript:', transcript);
                      } else {
                        console.log('📝 Partial transcript:', transcript);
                      }
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.error('❌ Transcription stream error:', error);
            if (ws.readyState === 1) { // WebSocket.OPEN
              ws.send(JSON.stringify({
                type: 'error',
                message: error.message,
              }));
            }
          }
        })();

      } else if (data.type === 'audio' && isStreaming) {
        // Send audio chunk to Transcribe
        const audioChunk = Buffer.from(data.audio, 'base64');
        audioQueue.push(audioChunk);
        
        // Resume generator if it was waiting
        if (audioQueueResolver) {
          audioQueueResolver();
          audioQueueResolver = null;
        }
        
      } else if (data.type === 'stop') {
        // Stop transcription
        console.log('🛑 Stopping transcription stream...');
        isStreaming = false;
        
        // Resume generator to allow it to finish
        if (audioQueueResolver) {
          audioQueueResolver();
          audioQueueResolver = null;
        }
        
        // Wait for transcription to complete
        if (transcriptionPromise) {
          try {
            await transcriptionPromise;
          } catch (error) {
            console.error('Error waiting for transcription:', error);
          }
        }
        
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(JSON.stringify({ type: 'stopped' }));
        }
      }
    } catch (error) {
      console.error('❌ WebSocket error:', error);
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message,
        }));
      }
    }
  });

    ws.on('close', async () => {
      console.log('🔌 WebSocket closed, cleaning up...');
      isStreaming = false;
      
      if (audioQueueResolver) {
        audioQueueResolver();
        audioQueueResolver = null;
      }
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

    const region = process.env.AWS_REGION || 'us-east-1';
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

/**
 * Legacy endpoint - uses batch transcription for backward compatibility
 */
router.post('/', upload.single('audio'), async (req, res) => {
  // Redirect to batch endpoint
  req.url = '/batch';
  router.handle(req, res);
});

module.exports = { router, setupTranscribeWebSocket };
