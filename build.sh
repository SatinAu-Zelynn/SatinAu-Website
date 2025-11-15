set -e

echo "[BUILD] 注入配置变量..."

# 确保变量存在
: "${SUPABASE_URL:?SUPABASE_URL 未设置}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY 未设置}"
: "${BUILD_INFO:?BUILD_INFO 未设置}"

# 生成配置文件
printf "%s" "$BUILD_INFO" | \
sed -e "s|__SUPABASE_URL__|$SUPABASE_URL|g" \
    -e "s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|g" \
    -e "/__BUILD_INFO__/{
        r /dev/stdin
        d
    }" src/script/config.template.js > src/script/config.js

echo "[BUILD] 配置文件生成成功"