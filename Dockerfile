FROM c4illin/convertx:v0.14.1

COPY components /app/src/components
COPY pages /app/src/pages
COPY public /app/public

LABEL 镜像制作者="https://space.bilibili.com/17547201"
LABEL GitHub主页="https://github.com/Firfr/convertx-zh"
LABEL Gitee主页="https://gitee.com/firfe/convertx-zh"

# docker build -t firfe/convertx-zh:0.14.1 .
