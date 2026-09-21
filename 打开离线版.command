#!/bin/bash
# ============================================================
# 双击本文件，即可用浏览器打开「网络攻防指挥控制决策系统」离线版演示
# 完全不需要联网，也不需要启动任何服务器。
#
# 改完代码后直接再双击一次即可：
#   脚本会自动检测源码是否有更新并重新构建，然后打开最新版本。
# ============================================================
cd "$(dirname "$0")" || exit 1

HTML="out-offline/index.html"

# --- 1. 让 Terminal 里也能找到 node（双击运行时 PATH 往往不全）---
export PATH="$HOME/.workbuddy/binaries/node/versions/22.22.2-3/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [ -x "$d/npm" ] && export PATH="$d:$PATH"
  done
fi

need_node() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "未检测到 Node.js / npm。"
    echo "请先安装 Node.js 18+（https://nodejs.org），再重新双击本文件。"
    echo "（如果只是想看旧版本：直接双击 $HTML 也可以）"
    read -r -p "按回车键退出..."
    exit 1
  fi
}

# --- 2. 判断是否需要重新构建 ---
needs_build=0
reason=""

if [ ! -f "$HTML" ]; then
  needs_build=1
  reason="首次构建"
elif [ -n "$(find src index.html vite.config.ts package.json -type f -newer "$HTML" -print -quit 2>/dev/null)" ]; then
  needs_build=1
  reason="检测到源码有更新"
fi

if [ "$needs_build" = "1" ]; then
  need_node

  # 依赖有变化时先补装依赖（package.json 比上次安装还新）
  if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
    echo "依赖有变化，正在执行 npm install（可能需要几分钟）..."
    npm install --no-audit --no-fund || {
      echo ""
      echo "npm install 失败，请检查网络或 Node.js 环境。"
      read -r -p "按回车键退出..."
      exit 1
    }
  fi

  echo "$reason，正在重新构建离线单文件（约 3-10 秒）..."
  npm run build:offline || {
    echo ""
    echo "构建失败。请把上面的报错信息发出来排查。"
    read -r -p "按回车键退出..."
    exit 1
  }
  echo "构建完成。"
else
  echo "源码无变化，直接打开已有产物。"
fi

# --- 3. 打开 ---
open "$HTML"
echo ""
echo "已在默认浏览器中打开离线版演示：$HTML"
echo "（这个 html 是自包含的，可以直接复制/发送给别人，双击即可打开）"
