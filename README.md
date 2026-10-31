# Arcadia · 阿卡迪亚世界图志

互动地图、十五处地点图鉴与可自由探索的 Three.js 三维世界。

## 网页入口

[进入阿卡迪亚三维世界](https://arcadia-tan-t2001.smartlamb258.chatgpt.site/#world3d)

网站由 Sites 私有托管，访问需要登录有权限的 ChatGPT 账号。当前默认仅所有者可访问，所有者可以通过网站分享设置授权指定邮箱，并随时撤销访问。

此 GitHub 仓库为 private，源码协作者与网页访客分别管理。网页访客使用网站授权，源码协作者由仓库所有者在 GitHub 设置中邀请。

## 内容与操作

- `atlas/` 包含网页、三维模型、概念图与素材审阅工具。
- `refs/` 包含原始参考与补充设定。
- 环绕查看使用左键旋转、WASD 或方向键平移、滚轮缩放。
- 自由飞行使用 WASD 或方向键移动、Q/E 升降、Shift 加速。
- 线上修改建议保存在访客自己的浏览器中，可导出 JSON 分享给作者。

## 本地运行与发布准备

双击 `atlas/打开3D世界.cmd` 启动本地三维网页。本地服务也支持把修改建议保存到项目目录。

```sh
cd atlas
npm run check
cd ..
python build_site.py
```

`build_site.py` 将网页与素材整理到 `dist/`，并启用浏览器本地保存模式。托管项目记录在 `.openai/hosting.json`。更新网站时，将检查通过的源码同步到 Sites 的项目源仓库，再打包发布。GitHub 仓库负责保存源文件与版本。
