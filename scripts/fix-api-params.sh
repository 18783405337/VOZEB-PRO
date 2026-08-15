#!/bin/bash

# 批量修复 Next.js 15 params Promise 问题的脚本

echo "🔧 开始批量修复 API 路由的 params 类型问题..."

# 查找所有需要修复的文件
files=$(find web/src/app/api/canvas -name "route.ts")

count=0
for file in $files; do
    if grep -q "{ params }" "$file"; then
        echo "修复: $file"

        # 备份文件
        cp "$file" "$file.bak"

        # 使用 sed 修复 params 解构
        # 需要在函数体开始处添加 await
        sed -i 's/async function \([A-Z]*\)(\(.*\)context: { params: {\([^}]*\)};\? }/async function \1(\2context: { params: Promise<{\3}>; }/g' "$file"

        count=$((count + 1))
    fi
done

echo "✅ 已修复 $count 个文件"
