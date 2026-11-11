# 免费发布网页版

这个游戏是纯静态网站，没有后端、数据库或付费 API。以下方式都可以免费生成可供别人访问的网页链接。

## 推荐：GitHub Pages

适合长期分享，公开仓库和 GitHub Pages 本身免费。

### 使用当前项目自动部署

项目已包含：

```text
.github/workflows/deploy-animal-stack.yml
```

它只会发布 `game/` 目录，不会公开 Python 项目的其他内容。

步骤：

1. 在 GitHub 创建一个 **Public** 仓库。
2. 将当前项目推送到仓库的 `main` 分支。
3. 打开仓库的 `Settings` → `Pages`。
4. 在 `Build and deployment` 中将 `Source` 设为 `GitHub Actions`。
5. 等待 `Deploy Animal Stack to GitHub Pages` 工作流完成。
6. 在 Actions 的部署结果中获取免费网址，通常类似：

```text
https://你的用户名.github.io/仓库名/
```

以后每次推送到 `main`，网页都会自动更新。

> 免费方案使用 `github.io` 子域名即可，不需要购买域名。

### 只上传游戏文件

如果不想在仓库里放 Python 代码：

1. 新建一个 Public 仓库。
2. 将 `game/` 目录里的全部内容上传到仓库根目录。
3. 在 `Settings` → `Pages` 中选择 `Deploy from a branch`。
4. 分支选择 `main`，目录选择 `/ (root)`。

## 最简单：Netlify Drop

不需要命令行：

1. 打开 <https://app.netlify.com/drop>。
2. 将整个 `game/` 文件夹拖入网页。
3. 等待上传完成，会获得一个免费的 `*.netlify.app` 链接。
4. 把链接发给别人即可。

如果需要以后自动更新，可以把 GitHub 仓库连接到 Netlify。项目根目录的 `netlify.toml` 已配置为只发布 `game/` 目录。

## 备选：Cloudflare Pages

Cloudflare Pages 也提供免费静态站点托管：

1. 将项目推送到 GitHub。
2. 在 Cloudflare Pages 中连接仓库。
3. 构建命令留空。
4. 输出目录填写 `game`。

## 已包含的网页能力

- 手机、平板和桌面响应式布局
- PWA 安装支持
- 首次访问后离线缓存
- 本地最高分保存
- 不依赖 CDN、外部图片或字体
- 不需要服务器运行 Python

部署到 HTTPS 网站后，用户在 Chrome、Edge 或 Safari 中可以把游戏“添加到主屏幕”。

## 免费方案的限制

- 最高分只保存在每台设备自己的浏览器中，不会跨设备同步。
- 没有排行榜、账号、广告、支付或后端数据。
- 更新游戏后，如果浏览器仍显示旧版本，可以将 `game/sw.js` 中的 `CACHE_VERSION` 改成一个新值，例如 `animal-stack-v2`。
- 免费子域名已经够用。付费域名、数据库和商业托管服务都不是必需的。

## 本地检查

发布前可在项目根目录运行：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/game/
```

`localhost` 也可以测试 PWA 安装和离线缓存。
