#!/usr/bin/env node

/**
 * Generate a PNG logo from the Glowing Orb design
 * 
 * This script creates a static version of the glowing orb component
 * as a PNG image suitable for app icons and splash screens.
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Configuration
const SIZE = 1024; // Output size (square)
const CENTER = SIZE / 2;
const PADDING = SIZE * 0.2; // 20% padding for Android adaptive icon safe zone

// Colors from the glowing orb component (dark mode - default theme)
const COLORS = {
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
  
  // Background - dark mode theme
  background: '#151718',
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

// Helper to draw gradient circle with angular gradient (for rings)
function drawAngularGradientCircle(ctx, x, y, radius, colors) {
  // Create a linear gradient that we'll use in a circular pattern
  // We'll draw multiple segments to simulate the gradient
  const segments = 60;
  const angleStep = (Math.PI * 2) / segments;
  
  for (let i = 0; i < segments; i++) {
    const angle1 = i * angleStep;
    const angle2 = (i + 1) * angleStep;
    
    // Determine color based on angle (simplified)
    const colorIndex = Math.floor((i / segments) * colors.length);
    const color = colors[Math.min(colorIndex, colors.length - 1)];
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, angle1, angle2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// Generate logo with transparent background (for favicon and splash screen)
function generateOrbLogoTransparent(outputPath, size = SIZE) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // No background fill - transparent background
  
  const centerX = size / 2;
  const centerY = size / 2;
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
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Generated orb logo with transparent background: ${outputPath} (${size}x${size}px)`);
}

// Generate logo with proper padding for Android adaptive icons (with background)
function generateOrbLogoWithPadding(outputPath, size = SIZE) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Set background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, size, size);
  
  // For Android adaptive icons, the safe zone is the middle 60% (20% padding on all sides)
  const safeZoneSize = size * 0.6;
  const padding = size * 0.2;
  const centerX = size / 2;
  const centerY = size / 2;
  const scale = safeZoneSize / 200; // Original orb is 200x200, scale to fit in safe zone
  
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
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Generated orb logo with padding: ${outputPath} (${size}x${size}px)`);
}

// Main execution
const outputDir = path.join(__dirname, '..', 'assets', 'images');
const logoPath = path.join(outputDir, 'logo.png'); // With background for Android adaptive icon
const logoTransparentPath = path.join(outputDir, 'logo-transparent.png'); // Transparent for favicon and splash

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate both versions
try {
  // Generate logo with background for Android adaptive icon
  generateOrbLogoWithPadding(logoPath, SIZE);
  
  // Generate transparent logo for favicon and splash screen
  generateOrbLogoTransparent(logoTransparentPath, SIZE);
  
  console.log(`\n✨ Logos generated successfully!`);
  console.log(`📁 Logo (with background): ${logoPath}`);
  console.log(`📁 Logo (transparent): ${logoTransparentPath}`);
  console.log(`\n💡 Transparent logo works for both light and dark modes!`);
} catch (error) {
  console.error('❌ Error generating logos:', error);
  process.exit(1);
}

