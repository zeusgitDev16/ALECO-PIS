#!/bin/bash

# 1. Push changes to GitHub
echo "🚀 Pushing code to GitHub..."
git add .
git commit -m "Auto-deploy: $(date)"
git push origin main

# 2. Command the VM to forcefully sync and restart
echo "⚡ Updating Backend VM..."
ssh aezymillete16@35.233.196.65 "cd /home/aezymillete16/ALECO-PIS/ALECO_PIS && git fetch --all && git reset --hard origin/main && pm2 restart aleco-backend"

echo "✅ SUCCESS! ALECO PIS is 100% updated and live."