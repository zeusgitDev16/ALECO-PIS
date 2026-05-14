#!/bin/bash

# Exit immediately if any command fails
set -e

# 1. Push changes to GitHub
echo "🚀 Pushing code to GitHub..."
git add .
git commit -m "Auto-deploy: $(date)"
git push origin main

# 2. Command the VM to sync and restart
echo "⚡ Updating Backend VM..."

# We wrap the SSH command in an 'if' block to catch errors
if ssh aezymillete16@35.233.196.65 "cd /home/aezymillete16/ALECO-PIS/ALECO_PIS && git fetch --all && git reset --hard origin/main && pm2 restart aleco-backend"; then
    echo "✅ SUCCESS! ALECO PIS is 100% updated and live."
else
    echo "❌ ERROR: Failed to update the VM. Check your SSH connection."
    exit 1
fi