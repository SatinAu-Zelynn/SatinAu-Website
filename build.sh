set -e

echo "[BUILD] 开始生成构建信息..."

# ==========================================
# 定义 SVG 图标资源 (使用单引号以保留 HTML 中的双引号)
# ==========================================

# Cloudflare Logo
SVG_CF='<svg class="footer-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Cloudflare</title><path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"/></svg>'

# Cloudflare Pages Logo
SVG_CF_PAGES='<svg class="footer-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Cloudflare Pages</title><path d="M10.715 14.32H5.442l-.64-1.203L13.673 0l1.397.579-1.752 9.112h5.24l.648 1.192L10.719 24l-1.412-.54ZM4.091 5.448a.5787.5787 0 1 1 0-1.1574.5787.5787 0 0 1 0 1.1574zm1.543 0a.5787.5787 0 1 1 0-1.1574.5787.5787 0 0 1 0 1.1574zm1.544 0a.5787.5787 0 1 1 0-1.1574.5787.5787 0 0 1 0 1.1574zm8.657-2.7h5.424l.772.771v16.975l-.772.772h-7.392l.374-.579h6.779l.432-.432V3.758l-.432-.432h-4.676l-.552 2.85h-.59l.529-2.877.108-.552ZM2.74 21.265l-.772-.772V3.518l.772-.771h7.677l-.386.579H2.98l-.432.432v16.496l.432.432h5.586l-.092.579zm1.157-1.93h3.28l-.116.58h-3.55l-.192-.193v-3.473l.578 1.158zm13.117 0 .579.58H14.7l.385-.58z"/></svg>'

# Cloudflare Workers Logo
SVG_CF_WORKERS='<svg class="footer-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Cloudflare Workers</title><path d="m8.213.063 8.879 12.136-8.67 11.739h2.476l8.665-11.735-8.89-12.14Zm4.728 0 9.02 11.992-9.018 11.883h2.496L24 12.656v-1.199L15.434.063ZM7.178 2.02.01 11.398l-.01 1.2 7.203 9.644 1.238-1.676-6.396-8.556 6.361-8.313Z"/></svg>'

# Vercel Logo
SVG_VERCEL='<svg class="footer-icon-a" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m12 1.608 12 20.784H0Z"/></svg>'

# ==========================================
# 逻辑判断与字符串拼接
# ==========================================

FINAL_INFO=""

if [ -n "$CF_PAGES" ]; then
    # --- Cloudflare Pages 环境 ---
    echo "Detected Environment: Cloudflare Pages"
    COMMIT_HASH=${CF_PAGES_COMMIT_SHA:0:7}
    BRANCH=$CF_PAGES_BRANCH
    
    # 构建版本后缀
    VERSION_SUFFIX=""
    if [ "$BRANCH" == "test" ]; then
        VERSION_SUFFIX="（测试版）"
    fi

    # 拼接 Cloudflare 专用 HTML (注意 \n 用于换行)
    FINAL_INFO="${SVG_CF}Cloudflare${SVG_CF_PAGES}${SVG_CF_WORKERS}提供静态托管和CDN服务 版本: ${COMMIT_HASH}${VERSION_SUFFIX}"

elif [ -n "$VERCEL" ]; then
    # --- Vercel 环境 ---
    echo "Detected Environment: Vercel"
    COMMIT_HASH=${VERCEL_GIT_COMMIT_SHA:0:7}
    
    # 拼接 Vercel 专用 HTML
    FINAL_INFO="${SVG_VERCEL}Vercel 提供静态托管服务 版本: ${COMMIT_HASH}"

else
    # --- 本地/其他环境 (回退方案) ---
    echo "Detected Environment: Local/Generic"
    
    # 尝试获取 Git 信息
    if command -v git &> /dev/null && [ -d .git ]; then
        COMMIT_HASH=$(git rev-parse --short HEAD)
    else
        COMMIT_HASH="local-dev"
    fi
    
    FINAL_INFO="本地环境构建 版本: ${COMMIT_HASH}"
fi

echo "[BUILD] 版本信息预览:"
echo -e "$FINAL_INFO"

# ==========================================
# 写入配置文件
# ==========================================

# 使用 printf %b 来解释 \n 为实际换行符，并写入 config.js
printf "%b" "$FINAL_INFO" | \
sed -e "/__BUILD_INFO__/{
        r /dev/stdin
        d
    }" src/script/config.template.js > src/script/config.js

echo "[BUILD] 配置文件 src/script/config.js 生成成功"