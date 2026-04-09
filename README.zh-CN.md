# plot-mcp-worker

`plot-mcp-worker` 是一个部署在 Cloudflare Worker 上的 MCP 服务，用于封装绘图、图像链接生成、受力分析图和简单 3D 图形链接能力，底层依赖上游 Plot API。

## 功能

- 提供统一的 MCP 绘图接口
- 支持单函数、多函数、自定义数据序列绘图
- 支持 JSON 返回和 PNG 直链返回
- 支持受力分析 SVG 图生成
- 支持简单 3D 图形页面链接生成
- Worker 轻量部署，上游地址可配置

## 工具列表

### 健康检查
- `health`

### 绘图类
- `plot`
- `plot_json`
- `plot_png_link`
- `plot_multi`
- `plot_multi_json`
- `plot_multi_png_link`
- `plot_series`
- `plot_series_json`
- `plot_series_png_link`

### 图示 / 3D 类
- `force_diagram_link`
- `shape3d_link`

## 项目结构

```text
plot-mcp-worker/
├── src/index.js        # Worker 入口与 MCP tool 实现
├── wrangler.toml       # Cloudflare Worker 配置
├── package.json        # 本地开发依赖
└── README.md
```

## 本地开发

```bash
npm install
npx wrangler dev --local --port 8790
```

健康检查：

```bash
curl http://127.0.0.1:8790/healthz
```

## 部署

```bash
npx wrangler deploy
```

当前默认路由：

- `plot-mcp.qdp.qzz.io/*`

当前配置的上游 API：

- `https://lingion.pythonanywhere.com`

## 说明

- PNG 结果通过 Worker 的辅助路由进行转发。
- 受力分析图以 SVG 形式直接生成。
- 3D 图形链接返回的是可嵌入 HTML 页面，底层使用 Plotly。
