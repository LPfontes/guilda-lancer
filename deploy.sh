#!/usr/bin/env bash
set -e

APP_DIR="${APP_DIR:-guilda-lancer}"

echo "========================================="
echo "   GUILDA LANCER // DEPLOY INICIADO      "
echo "========================================="

echo "[1/4] Atualizando código fonte com git..."
git pull origin master

echo "[2/4] Compilando Frontend (Client)..."
cd client
npm ci
npm run build
cd ..

echo "[3/4] Compilando Backend (Server)..."
cd server
npm ci
npm run build
cd ..

echo "[4/4] Reiniciando aplicação no PM2..."
pm2 reload lancer-api --update-env || pm2 restart lancer-api --update-env

echo "========================================="
echo "   DEPLOY CONCLUÍDO COM SUCESSO!         "
echo "========================================="
