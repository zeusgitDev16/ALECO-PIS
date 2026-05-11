#!/bin/bash

# 1. Push changes to GitHub from your laptop
echo "🚀 Pushing code to GitHub..."
git add .
git commit -m "Auto-deploy: $(date)"
git push origin main

# 2. Command the VM to pull and restart
echo "⚡ Commanding VM to update..."
ssh aezymillete16@35.233.196.65 "cd /home/aezymillete16/ALECO-PIS/ALECO_PIS && git pull origin main && pm2 restart aleco-backend"

echo "✅ SUCCESS! ALECO PIS is updated and live."