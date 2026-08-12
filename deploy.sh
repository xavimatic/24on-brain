#!/bin/bash
echo "🚀 Iniciando despliegue de segundo-cerebro..."
git pull origin main
npm install --include=dev
npx prisma generate
npx prisma db push
npm run build
pm2 restart segundo-cerebro || pm2 start npm --name "segundo-cerebro" -- start -- -p 3001
echo "✅ Despliegue completado con éxito."
