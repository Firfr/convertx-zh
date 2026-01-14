#!/bin/bash
export LANG=C.UTF-8

if [ ${#} -eq 0 ]; then
    echo "❌ 请提供文件路径"
    exit 1
fi

FILE="$1"
[ ! -f "$FILE" ] && { echo "❌ 文件不存在"; exit 1; }

echo "✅ 开始处理文件：$FILE"

# 定义搜索文本（不需要手动转义正则字符）
SEARCH_RAW='children: ["ConvertX", " "] }), _jsxs("span"'

# 定义替换内容
REPLACE_CONTENT='children: ["ConvertX", " "] }),\
_jsx("span", { children: "汉化 " }),\
_jsxs("a", {\
  href: "https://space.bilibili.com/17547201/search?keyword=ConvertX",\
  class: `text-neutral-400 hover:text-accent-500`,\
  children: ["秦曱凧", " "],\
}),\
_jsxs("span"'

# 执行替换
# \Q ... \E : 将中间的内容视为纯文本，忽略所有正则特殊符号
# | : 使用竖线作为分隔符，避免 URL 中的 / 冲突
perl -i -pe \
  "s|\Q${SEARCH_RAW}\E|${REPLACE_CONTENT}|g" \
  "$FILE"

echo "✅ 处理完成：$FILE"
