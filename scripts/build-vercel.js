const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Running Viralis Vercel Deployment Build...');

const frontendDir = path.join(__dirname, '..', 'frontend');
const rootDir = path.join(__dirname, '..');

// 1. Ensure frontend dependencies are installed
if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
    console.log('📦 Installing frontend dependencies...');
    execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
}

// 2. Build the Next.js frontend application
console.log('🔨 Building Next.js production bundle...');
execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

// 3. Mirror .next and public to repository root for Vercel root detection
const frontendNext = path.join(frontendDir, '.next');
const rootNext = path.join(rootDir, '.next');
const frontendPublic = path.join(frontendDir, 'public');
const rootPublic = path.join(rootDir, 'public');

if (fs.existsSync(frontendNext)) {
    console.log('📁 Syncing .next build artifact to root directory...');
    if (fs.existsSync(rootNext)) {
        fs.rmSync(rootNext, { recursive: true, force: true });
    }
    fs.cpSync(frontendNext, rootNext, { recursive: true });
}

if (fs.existsSync(frontendPublic) && !fs.existsSync(rootPublic)) {
    console.log('📁 Syncing public assets to root directory...');
    fs.cpSync(frontendPublic, rootPublic, { recursive: true });
}

console.log('🎉 Viralis build completed successfully!');
