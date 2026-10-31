# Arcadia · 阿卡迪亚世界图志

互动地图、十五处地点图鉴与可自由探索的 Three.js 三维世界。

## 网页入口

[进入阿卡迪亚三维世界](https://tan-t2001.github.io/arcadia/#world3d)

仓库与网页均为 Public，任何人都可以打开。网页由 GitHub Pages 托管。

公开发布与受邀访问的设置方法见[访问权限说明](访问权限说明.md)。

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

`build_site.py` 将网页与素材整理到 `dist/`，并启用浏览器本地保存模式。每次推送到 `main`，`.github/workflows/pages.yml` 会自动检查、打包并发布网页。

仓库 Settings → Pages → Source 选择 GitHub Actions。等待 Actions 中的发布任务成功，即可使用上方网址。
