#!/usr/bin/env bash
set -e

echo "[BUILD] Injecting config variables..."

# 确保变量存在
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY not set}"
: "${BUILD_INFO:?BUILD_INFO not set}"

# 生成配置文件
sed -e "s|__SUPABASE_URL__|$SUPABASE_URL|g" \
    -e "s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|g" \
    -e "s|__BUILD_INFO__|$BUILD_INFO|g" \
    script/config.template.js > public/script/config.js

echo "[BUILD] Config generated successfully."