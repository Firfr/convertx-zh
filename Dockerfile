FROM c4illin/convertx:v0.15.1

COPY 代码/dist /app/dist
COPY 代码/public /app/public

LABEL 镜像制作者="https://space.bilibili.com/17547201"
LABEL GitHub主页="https://github.com/Firfr/convertx-zh"
LABEL Gitee主页="https://gitee.com/firfe/convertx-zh"

# docker build -t firfe/convertx-zh:0.15.1 .
