#!/usr/bin/env node

/**
 * Generate Google Play Store Feature Graphic
 * 
 * Creates a 1024x500px feature graphic with the Bridge AI logo and text
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Configuration
const WIDTH = 1024;
const HEIGHT = 500;

// Colors from the app theme (dark mode)
const COLORS = {
  background: '#151718',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  accent: '#007AFF',
  
  // Glow layers (outer to inner) - dark mode
  glow1: 'rgba(74, 158, 255, 0.12)',
  glow2: 'rgba(107, 179, 255, 0.15)',
  glow3: 'rgba(135, 199, 255, 0.18)',
  glow4: 'rgba(74, 158, 255, 0.2)',
  glow5: 'rgba(107, 179, 255, 0.22)',
  glow6: 'rgba(135, 199, 255, 0.25)',
  
  // Core gradient - dark mode
  core1: '#C0DBFF',
  core2: '#87C7FF',
  core3: '#B8D6FF',
  
  // Gradient ring colors - dark mode
  ring1: ['rgba(74, 158, 255, 0.5)', 'rgba(135, 199, 255, 0.2)', 'rgba(74, 158, 255, 0.5)'],
  ring2: ['rgba(135, 199, 255, 0.4)', 'rgba(74, 158, 255, 0.15)', 'rgba(135, 199, 255, 0.4)'],
  
  // Shine - dark mode
  shine: 'rgba(255, 255, 255, 0.25)',
};

// Helper to create radial gradient
function createRadialGradient(ctx, x, y, innerRadius, outerRadius, colors) {
  const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, outerRadius);
  const step = 1 / (colors.length - 1);
  colors.forEach((color, i) => {
    gradient.addColorStop(i * step, color);
  });
  return gradient;
}

// Helper to draw circle
function drawCircle(ctx, x, y, radius, fill) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// Draw the orb logo
function drawOrb(ctx, centerX, centerY, size) {
  const scale = size / 200; // Original orb is 200x200
  
  // Draw glow layers (from outer to inner)
  const glowLayers = [
    { radius: 100 * scale, color: COLORS.glow1, opacity: 0.4 * 0.4 },
    { radius: 92.5 * scale, color: COLORS.glow2, opacity: 0.4 * 0.45 },
    { radius: 80 * scale, color: COLORS.glow3, opacity: 0.5 * 0.5 },
    { radius: 70 * scale, color: COLORS.glow4, opacity: 0.5 * 0.55 },
    { radius: 60 * scale, color: COLORS.glow5, opacity: 0.6 * 0.6 },
    { radius: 52.5 * scale, color: COLORS.glow6, opacity: 0.65 * 0.65 },
  ];
  
  glowLayers.forEach(layer => {
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    drawCircle(ctx, centerX, centerY, layer.radius, layer.color);
    ctx.restore();
  });
  
  // Draw gradient rings
  ctx.save();
  ctx.globalAlpha = 0.5;
  const ring1Gradient = createRadialGradient(ctx, centerX, centerY, 0, 50 * scale, COLORS.ring1);
  drawCircle(ctx, centerX, centerY, 50 * scale, ring1Gradient);
  ctx.restore();
  
  ctx.save();
  ctx.globalAlpha = 0.4;
  const ring2Gradient = createRadialGradient(ctx, centerX, centerY, 0, 45 * scale, COLORS.ring2);
  drawCircle(ctx, centerX, centerY, 45 * scale, ring2Gradient);
  ctx.restore();
  
  // Draw core orb
  const coreRadius = 40 * scale;
  const coreGradient = ctx.createRadialGradient(
    centerX - coreRadius * 0.3,
    centerY - coreRadius * 0.3,
    0,
    centerX,
    centerY,
    coreRadius
  );
  coreGradient.addColorStop(0, COLORS.core1);
  coreGradient.addColorStop(0.5, COLORS.core2);
  coreGradient.addColorStop(1, COLORS.core3);
  
  drawCircle(ctx, centerX, centerY, coreRadius, coreGradient);
  
  // Add shadow/glow effect around core
  ctx.save();
  ctx.shadowColor = '#007AFF';
  ctx.shadowBlur = 30 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  drawCircle(ctx, centerX, centerY, coreRadius, coreGradient);
  ctx.restore();
  
  // Draw inner shine
  const shineX = centerX - coreRadius * 0.25;
  const shineY = centerY - coreRadius * 0.25;
  const shineRadius = 15 * scale;
  drawCircle(ctx, shineX, shineY, shineRadius, COLORS.shine);
}

function generateFeatureGraphic(outputPath) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // Set background with gradient
  const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGradient.addColorStop(0, '#151718');
  bgGradient.addColorStop(0.5, '#1a1b1e');
  bgGradient.addColorStop(1, '#151718');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // Add more prominent glow effects in background
  ctx.save();
  ctx.globalAlpha = 0.25;
  const glow1 = ctx.createRadialGradient(WIDTH * 0.15, HEIGHT * 0.25, 0, WIDTH * 0.15, HEIGHT * 0.25, 400);
  glow1.addColorStop(0, 'rgba(74, 158, 255, 0.4)');
  glow1.addColorStop(0.5, 'rgba(74, 158, 255, 0.2)');
  glow1.addColorStop(1, 'rgba(74, 158, 255, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  const glow2 = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.75, 0, WIDTH * 0.85, HEIGHT * 0.75, 350);
  glow2.addColorStop(0, 'rgba(135, 199, 255, 0.35)');
  glow2.addColorStop(0.5, 'rgba(135, 199, 255, 0.15)');
  glow2.addColorStop(1, 'rgba(135, 199, 255, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
  
  // Calculate positions - MASSIVE logo and EXTREME text
  const logoSize = 400; // Logo size (perfect as is)
  const textSize = 2000; // 2000% increase - 20x bigger! EXTREME text size!
  const logoX = 250; // Logo position (perfect as is)
  const logoY = HEIGHT / 2; // Center vertically
  
  const textX = logoX + logoSize + 50; // Text right after logo
  const textY = HEIGHT / 2; // Center vertically
  
  // Draw the orb logo - keep it as is (perfect)
  drawOrb(ctx, logoX, logoY, logoSize);
  
  // Draw "Bridge AI" text - EXTREME SIZE in theme blue!
  const themeBlue = '#007AFF'; // Theme blue color
  ctx.fillStyle = themeBlue;
  ctx.font = `bold ${textSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // Add text shadow for better visibility
  ctx.shadowColor = 'rgba(0, 122, 255, 0.8)';
  ctx.shadowBlur = 150;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Split "Bridge AI" into two lines - MINIMAL spacing for maximum size
  ctx.fillText('Bridge', textX, textY - textSize * 0.08);
  ctx.fillText('AI', textX, textY + textSize * 0.08);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Generated feature graphic: ${outputPath} (${WIDTH}x${HEIGHT}px)`);
  
  // Check file size
  const stats = fs.statSync(outputPath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 File size: ${fileSizeMB} MB`);
  
  if (stats.size > 15 * 1024 * 1024) {
    console.warn('⚠️  Warning: File size exceeds 15 MB limit!');
  }
}

// Main execution
const outputDir = path.join(__dirname, '..', 'assets', 'images');
const featureGraphicPath = path.join(outputDir, 'feature-graphic.png');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate the feature graphic
try {
  generateFeatureGraphic(featureGraphicPath);
  console.log(`\n✨ Feature graphic generated successfully!`);
  console.log(`📁 Location: ${featureGraphicPath}`);
  console.log(`\n📱 Ready for Google Play Console upload!`);
} catch (error) {
  console.error('❌ Error generating feature graphic:', error);
  process.exit(1);
}

