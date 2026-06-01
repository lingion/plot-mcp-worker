# plot-mcp-worker

[English](README.md)

基于 Cloudflare Workers 的无服务器图表渲染引擎。通过 MCP 协议对外提供服务，任何 AI Agent 发一条 JSON 即可拿到 publication 级别的 PNG/SVG 图表——不需要无头浏览器、不需要文件存储、不需要服务器。

渲染管线：SVG 构造 → CJK 文字转路径（opentype.js）→ resvg-wasm 光栅化为 PNG。中文字体通过 opentype.js 的 text-to-path 方案内嵌字形轮廓到 SVG 中，完全不依赖客户端字体环境，覆盖 GB2312 全集 + 中文标点 + 数学符号共 7500+ 字符。

**线上地址：** `https://plot-mcp.qdp.qzz.io/mcp`

---

## Showcase

### 1. 三角函数组合

![三角函数组合](docs/showcase/cn/01_trig_composition.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "cos(x)", "sin(x)+cos(x)"],
  "labels": ["sin(x)", "cos(x)", "sin(x) + cos(x)"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "三角函数组合"
}}
```

### 2. 方波——傅里叶级数逼近

![傅里叶逼近](docs/showcase/cn/02_fourier_approx.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "sin(x)+sin(3*x)/3", "sin(x)+sin(3*x)/3+sin(5*x)/5", "sin(x)+sin(3*x)/3+sin(5*x)/5+sin(7*x)/7"],
  "labels": ["1 项", "2 项", "3 项", "4 项"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "方波——傅里叶级数逼近"
}}
```

### 3. tan(x)——不连续检测

![tan 不连续](docs/showcase/cn/03_tan_discontinuity.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "tan(x)",
  "x_min": -4.712, "x_max": 4.712,
  "title": "tan(x)——不连续检测"
}}
```

### 4. sinc 函数: sin(x)/x

![sinc 函数](docs/showcase/cn/04_sinc_function.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)/x",
  "x_min": -15, "x_max": 15,
  "title": "sinc 函数: sin(x)/x"
}}
```

### 5. 1/(x²-1)——有理函数渐近线标注

![有理函数渐近线](docs/showcase/cn/05_rational_asymptotes.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "1/(x^2-1)",
  "x_min": -4, "x_max": 4,
  "title": "1/(x²-1)——有理函数",
  "annotations": [
    {"kind": "vertical_line", "x": -1, "label": "x = -1", "color": "#f87171"},
    {"kind": "vertical_line", "x": 1, "label": "x = 1", "color": "#f87171"}
  ]
}}
```

### 6. 阻尼振荡: e^(-0.3x)·sin(2x)

![阻尼振荡](docs/showcase/cn/06_damped_oscillation.png)

### 7. |sin(x)|·cos(x)——整流乘积

![整流乘积](docs/showcase/cn/07_absolute_value.png)

### 8. 高斯混合模型

![高斯混合](docs/showcase/cn/08_gaussian_mixture.png)

### 9. 衰减正弦 + 全标注套件

![标注峰值](docs/showcase/cn/09_annotated_peaks.png)

### 10. Q1-Q4 营收预测 vs 实际

![业务误差条](docs/showcase/cn/10_business_error_bars.png)

### 11. 性能基准测试（分组柱状 + 误差条）

![分组柱状](docs/showcase/cn/11_grouped_bars.png)

### 12. 云基础设施成本——堆叠

![堆叠柱状](docs/showcase/cn/12_stacked_bars.png)

### 13. AI 研究团队时间分配

![饼图](docs/showcase/cn/13_pie_chart.png)

### 14. 响应延迟分布

![直方图](docs/showcase/cn/14_histogram.png)

### 15. 模型精度跨数据集对比

![箱线图](docs/showcase/cn/15_box_plot.png)

### 16. 训练损失（对数坐标）

![对数坐标](docs/showcase/cn/16_log_scale.png)

### 17. 实验测量——非对称不确定度

![散点](docs/showcase/cn/17_scatter_asymmetric.png)

### 18. 变换管线：原始 → 平滑 → 归一化

![变换管线](docs/showcase/cn/18_transform_pipeline.png)

### 19. 函数画廊（2×2 子图）

![子图](docs/showcase/cn/19_subplot_2x2.png)

### 20. ∫₀³ (x² - x + 1) dx 定积分教学

![定积分教学](docs/showcase/cn/20_teaching_integral.png)

---

## 功能概览

### 图表类型

| 类型 | 说明 |
|------|------|
| 函数图 | 输入表达式 `f(x)`，自动检测三角函数/π轴模式、处理不连续点 |
| 多函数叠加 | 多条 `f(x)` 曲线在同一图上，自动生成图例 |
| 散点/折线 | 传入 `(x, y)` 数据数组，支持误差条 |
| 柱状图 | 普通/分组/堆叠柱状图，支持误差条 |
| 直方图 | 自动分箱 |
| 箱线图 | 分组分布对比，含四分位、中位数、离群点 |
| 饼图 | 标签 + 百分比 |
| 子图网格 | M×N 布局，支持共享坐标轴 |

### 坐标轴引擎

采用意图驱动的架构：调用方（通常是 AI）只传递语义意图，引擎负责计算实际的刻度值、标签和范围。

- **Nice ticks**：步长从 `{1, 2, 2.5, 5} × 10ⁿ` 中选取——不会出现 0.72、1.3 这种丑数
- **自动 π 轴**：三角函数自动获得 `−2π, −π, 0, π, 2π` 标签
- **三角 y 轴特殊处理**：sin/cos 自动用 `[-1, -0.5, 0, 0.5, 1]` 刻度
- **零点对称**：函数图默认 y 轴以零为中心
- **不连续检测**：符号翻转 + 大 Δy → 自动断开路径（tan(x)、1/x 等不会出现竖直尖刺）

### 中文渲染

CJK 文本通过 opentype.js 的 text-to-path 方案渲染：

1. SVG 正常生成 `<text>` 元素
2. 光栅化前，`pathifyCjkText()` 找到所有含 CJK 字符的 `<text>`
3. 用 opentype.js `font.getPath()` 转换为 `<path>`，将字形轮廓直接嵌入 SVG
4. resvg 渲染 path 版 SVG——完全不需要字体匹配

字体子集覆盖 **7,556 字符**：完整 GB2312（6,763 CJK + 符号）、ASCII、全角标点（·——、。，：；！？""''【】《》…）、数学符号（αβγπ∫∑√∞≤≥±）。

### 数据变换管线

渲染前可对数据系列执行变换：

| 变换 | 说明 |
|------|------|
| `normalize` | Min-max / z-score / max-abs 归一化 |
| `smooth` | 移动平均，可配置窗口大小 |
| `filter` | 按 x 或 y 范围过滤 |
| `rolling` | 滚动统计（均值、中位数、标准差） |
| `downsample` | 通过 min-max 或 LTTB 降采样 |

### 标注系统

- **竖直线 + 标签**（渐近线、阈值线）
- **点标记 + 文字**（峰值、零点、事件）
- **阴影区域 + 标签**（关注区域）
- **任意坐标文字标签**

### MCP 工具列表

通过 MCP 协议（HTTP POST 上的 JSON-RPC）暴露以下工具：

#### 绘图

| 工具名 | 说明 |
|--------|------|
| `plot` / `plot_png_link` | 单表达式绘图——自动 π轴、三角检测、不连续处理 |
| `plot_multi` / `plot_multi_png_link` | 多表达式叠加 |
| `plot_series` / `plot_series_png_link` | 自定义数据数组——散点/柱状/直方/箱线/饼 + 误差条 |
| `plot_bar` / `plot_bar_json` | 柱状图快捷方式 |
| `multi_plot` | M×N 子图网格 |

#### 示意图

| 工具名 | 说明 |
|--------|------|
| `force_diagram_link` | 受力分析图 |
| `force_analysis_link` | 带坐标轴、分量、合力的力学分析 |
| `force_analysis_template_link` | 预设力学模板（斜面、悬挂体等） |
| `circuit_diagram_link` | 电路原理图 |
| `circuit_template_link` | 预设电路模板（串联、并联等） |
| `venn_diagram_link` | 二集/三集韦恩图 |
| `c_memory_diagram_link` | C 语言内存布局/指针示意图 |
| `shape3d_link` | 交互式 3D 几何体查看器 |

#### 教学

| 工具名 | 说明 |
|--------|------|
| `teaching_template` | 单幅教学可视化（定积分、切线、抛体运动、简谐运动等） |
| `teaching_sequence` | 多幅协调教学图序列 |

#### 数据分析

| 工具名 | 说明 |
|--------|------|
| `analysis` | 统计操作：`describe`（描述统计）、`corr`（相关矩阵）、`groupby`（分组聚合） |

---

## 使用方式

### 接入 MCP 客户端

在任何 MCP 兼容客户端（Claude Desktop、OpenClaw、Cursor 等）中添加配置：

```json
{
  "mcpServers": {
    "plot": {
      "url": "https://plot-mcp.qdp.qzz.io/mcp"
    }
  }
}
```

然后直接对 AI 说：

> "画一个 sin(x)，范围 -2π 到 2π，带网格"

AI 会调用 `plot_png_link` 工具并返回 PNG 直链。

### 直接调用 API

不通过 AI，直接 HTTP 请求：

```bash
curl -X POST https://plot-mcp.qdp.qzz.io/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "plot_png_link",
      "arguments": {
        "expr": "sin(x)*exp(-0.1*x)",
        "title": "阻尼正弦波",
        "x_min": -10,
        "x_max": 30,
        "grid": true
      }
    }
  }'
```

返回值中的 `png_url` 指向渲染好的 PNG 图片（1000×720，暗色主题）。URL 使用压缩编码，大 payload 会自动使用短链接。

### 获取 SVG

如果需要 SVG 格式（可编辑、可缩放），将 `png_url` 中的 `/png` 换成 `/plot`：

```bash
curl "https://plot-mcp.qdp.qzz.io/plot?d=<压缩payload>"
```

---

## 自部署

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [Cloudflare](https://dash.cloudflare.com/) 账号（免费版即可）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（`npm install -g wrangler`）

### 1. 克隆并安装

```bash
git clone https://github.com/lingion/plot-mcp-worker.git
cd plot-mcp-worker
npm install
```

### 2. 创建 KV 命名空间

服务使用 Cloudflare KV 存储两类数据：
- **短链接**：PNG URL 超过 3,600 字符时，自动存为 KV 短链接
- **字体文件**：CJK 字体子集运行时从 KV 加载（让 Worker bundle 保持在 CF 免费版 3MB gzip 限制内）

```bash
npx wrangler kv namespace create SHORT_LINKS
```

将返回的命名空间 ID 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "SHORT_LINKS"
id = "<你的命名空间ID>"
```

### 3. 上传中文字体（可选）

如果需要中文渲染，上传字体子集到 KV：

```bash
npx wrangler kv key put "font:arial-unicode-cn-gb2312" \
  --namespace-id <你的命名空间ID> \
  --path 字体子集.ttf \
  --remote
```

不上传也能用——ASCII 和拉丁文字正常显示，但中文会显示为方框。

字体子集需要自己从 Arial Unicode MS 或其他支持中文的 TTF 字体中提取。推荐使用 [fonttools](https://github.com/fonttools/fonttools) 的 `pyftsubset` 工具，目标字符集：GB2312 + 常用中文标点 + 数学符号。

### 4. 部署

```bash
npx wrangler deploy
```

Worker 部署在 `https://<你的子域名>.workers.dev/mcp`。

### 5. 绑定自定义域名（可选）

在 `wrangler.toml` 中添加路由：

```toml
[[routes]]
pattern = "plot-mcp.yourdomain.com/*"
zone_name = "yourdomain.com"
```

### 配置项

主要配置在 `wrangler.toml` 和 `src/constants.ts` 中：

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `DEFAULT_WIDTH` | 1000 | 画布宽度（像素，数学预设） |
| `DEFAULT_HEIGHT` | 720 | 画布高度（像素） |
| `DEFAULT_FONT_FAMILY` | `ArialUnicodeCN` | CJK 字体族 |
| `DEFAULT_BG` | `safe-dark` | 暗色主题 |
| `DEFAULT_GRID` | true | 显示网格线 |
| `DEFAULT_PALETTE` | 8 色 | 折线颜色循环 |

### 本地开发

```bash
npx wrangler dev
# 启动在 http://127.0.0.1:8787
```

---

## 架构

```
MCP 请求 (JSON-RPC)
    │
    ▼
┌──────────────────┐
│   路由层 (index)   │  解析工具名 → 分发
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   图表构建器       │  标准化参数 → 构建 spec
│   (plot.ts)       │  检测三角函数、π轴模式、布局
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   SVG 渲染器       │  生成 SVG 字符串
│   (render.ts)     │  - 坐标轴、刻度、网格、标签
│                   │  - 数据系列（路径、矩形等）
│                   │  - 图例、标注
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  CJK 文字转路径    │  <text> → <path>
│  (opentype.js)    │  字体从 KV 加载，内存缓存
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  PNG 光栅化       │  resvg-wasm SVG → PNG
│                   │  返回 image/png 响应
└──────────────────┘
```

核心设计决策：
- **无头浏览器为零**：SVG 作为字符串构造，由 resvg-wasm（Rust → WASM）光栅化
- **字形路径内嵌**：CJK 字形预转为 SVG path，绕过 WASM 运行时的字体匹配问题
- **KV 存大资产**：字体文件（2.5MB）存 KV，每个 Worker isolate 加载一次，内存缓存
- **Bundle 体积**：~1MB gzip（CF 免费版 3MB 限制内）

---

## 依赖

| 包 | 用途 |
|---|------|
| [`@resvg/resvg-wasm`](https://github.com/nicbarker/resvg-js) | SVG → PNG 光栅化（Rust 编译为 WASM） |
| [`opentype.js`](https://opentype.js.org/) | CJK 文字转路径 |
| [`expr-eval`](https://github.com/silentmatt/expr-eval) | 数学表达式解析器，支持 `f(x)` 绘图 |

无其他运行时依赖。总 bundle ~1MB gzip。

---

## License

MIT
