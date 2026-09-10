#!/usr/bin/env bash
set -e

APP_DIR="${APP_DIR:-guilda-lancer}"

echo "========================================="
echo "   GUILDA LANCER // DEPLOY INICIADO      "
echo "========================================="

echo "[1/4] Atualizando código fonte com git..."
git pull origin master

echo "[2/4] Reconstruindo e reiniciando containers..."
docker compose down || true
docker compose up -d --build --remove-orphans

echo "[3/4] Limpando imagens antigas e dangling..."
docker image prune -f

echo "[4/4] Verificando status dos serviços..."
docker compose ps

echo "========================================="
echo "   DEPLOY CONCLUÍDO COM SUCESSO!         "
echo "========================================="
