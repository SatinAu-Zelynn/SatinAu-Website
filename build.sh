set -e

echo "[BUILD] 生成配置文件..."

# 生成配置文件
printf "%s" "$BUILD_INFO" | \
sed -e "/__BUILD_INFO__/{
        r /dev/stdin
        d
    }" src/script/config.template.js > src/script/config.js

echo "[BUILD] 配置文件生成成功"