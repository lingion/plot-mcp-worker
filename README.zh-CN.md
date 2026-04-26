# plot-mcp-worker

一个部署在 Cloudflare Worker 上的 MCP（Model Context Protocol）服务器，提供数学函数绘图、物理力学分析图、电路原理图、3D 几何体可视化和柱状图生成。所有图形在边缘端渲染，返回 PNG、SVG 或交互式 HTML。

## 功能

Plot MCP 将自然语言请求转为可发表的图像。AI 调用下方工具，Worker 在边缘端完成所有渲染（无外部 API 依赖），返回渲染结果。

- **数学绘图** — 单函数、多函数叠加、自定义 (x,y) 数据点、柱状图
- **物理力学图** — 自由体/受力分析 SVG，含分力、合力、角度、斜面
- **电路原理图** — 电池、电阻、灯泡、开关、电表、三极管、运放
- **3D 几何体** — 基于 Plotly 的交互式查看器（球体、立方体、锥体、环面等）
- **模板快捷方式** — 常见力学场景（斜面、悬挂、滑轮）和电路拓扑（串联、并联、LED+电阻）

中文渲染使用内置的 PingFang SC 子集字体，保持 Worker 自包含，同时避免携带完整系统字体文件。

## MCP 工具

### 数学绘图

| 工具 | 返回 | 说明 |
|------|------|------|
| `plot` | PNG 图像 | 绘制单个表达式 |
| `plot_json` | PNG base64 | 同上，结构化响应 |
| `plot_png_link` | PNG 链接 | 同上，返回可分享链接 |
| `plot_multi` | PNG 图像 | 多表达式叠加绘图 |
| `plot_multi_json` | PNG base64 | 同上，结构化响应 |
| `plot_multi_png_link` | PNG 链接 | 同上，可分享链接 |
| `plot_series` | PNG 图像 | 自定义 (x,y) 数据点绘图 |
| `plot_series_json` | PNG base64 | 同上，结构化响应 |
| `plot_series_png_link` | PNG 链接 | 同上，可分享链接 |
| `plot_bar_json` | PNG base64 | 柱状图 |
| `plot_multi_images` | 多张图 | 批量生成多个图表 |

### 物理力学图

| 工具 | 返回 | 说明 |
|------|------|------|
| `force_diagram_link` | SVG 链接 | 基础自由体图 |
| `force_analysis_link` | SVG 链接 | 完整受力分析（坐标轴、分力、合力、斜面） |
| `force_analysis_template_link` | SVG 链接 | 预置模板：斜面、悬挂、水平面、滑轮、弹簧、双物体、滑轮组、弹簧振子 |

### 电路原理图

| 工具 | 返回 | 说明 |
|------|------|------|
| `circuit_diagram_link` | SVG 链接 | 自定义电路（元件、导线、分支） |
| `circuit_template_link` | SVG 链接 | 预置模板：串联、并联、开关灯、电源电阻、LED电阻、电表回路、三极管开关、继电器驱动、蜂鸣器、运放跟随器 |

### 3D 几何体

| 工具 | 返回 | 说明 |
|------|------|------|
| `shape3d_link` | 交互式 HTML | 3D 几何体查看器 |

### 工具

| 工具 | 说明 |
|------|------|
| `health` | 检查 Worker 健康状态，列出可用工具 |

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

路由：`plot-mcp.qdp.qzz.io/*`。所有渲染在 Worker 内完成，无外部依赖。

## 项目结构

```
plot-mcp-worker/
├── src/
│   └── index.js        # Worker 入口、MCP 工具处理、渲染逻辑
├── wrangler.toml       # Cloudflare Worker 配置
├── package.json
└── README.md
```

## 限制

| 参数 | 限制 |
|------|------|
| 每图数据点 | 10 – 20,000 |
| 表达式长度 | 400 字符 |
| 标题/标签长度 | 120 / 80 字符 |
| 每图系列数 | 12 |
| 力学体/面/连接数 | 16 / 6 / 10 |
| 电路元件/导线数 | 24 / 48 |
