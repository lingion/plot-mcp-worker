# plot-mcp-worker

[English](README.md)

一个运行在 Cloudflare Workers 上的无服务器图表渲染引擎。通过 MCP（Model Context Protocol）协议暴露端点，让任何 AI Agent 通过一条 JSON 调用即可生成出版级 PNG/SVG 图表——无需无头浏览器、无需服务器、无需存储桶。

图表以 SVG 渲染，再通过 [resvg-wasm](https://github.com/nicbarker/resvg-js) 光栅化为 PNG。中文文本（GB2312 + 标点 + 数学符号，7500+ 字形）通过 opentype.js 的文本转路径管线处理，将字体轮廓直接嵌入 SVG，确保在任何客户端上正确渲染。

**在线端点：** `https://plot-mcp.qdp.qzz.io/mcp`

---

## 快速开始

### 在 MCP 客户端中使用

将以下配置添加到你的 MCP 客户端（Claude Desktop、Cursor 等）：

```json
{
  "mcpServers": {
    "plot": {
      "url": "https://plot-mcp.qdp.qzz.io/mcp"
    }
  }
}
```

即可使用，无需 API Key。你的 AI Agent 现在可以生成图表了。

### 通过 HTTP 调用

```bash
curl -X POST https://plot-mcp.qdp.qzz.io/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "plot_png_link",
      "arguments": {"expr": "sin(x)", "title": "正弦函数"}
    }
  }'
```

返回 JSON 响应中的 `png_url`。该 URL 提供预渲染的 PNG，缓存 5 分钟。

### 直接访问 PNG/SVG URL

```
https://plot-mcp.qdp.qzz.io/png?d=<base64url编码参数>
https://plot-mcp.qdp.qzz.io/plot?d=<base64url编码参数>
```

使用 `plot_png_link` 或 `plot` 工具获取正确编码的 URL。

---

## 自部署

### 前提条件

- [Node.js](https://nodejs.org/) 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（`npm install -g wrangler`）
- [Cloudflare](https://dash.cloudflare.com/) 账号（免费版即可）
- Cloudflare Workers KV 命名空间（用于字体存储和短链 URL）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/lingion/plot-mcp-worker.git
cd plot-mcp-worker

# 2. 安装依赖
npm install

# 3. 创建 KV 命名空间
npx wrangler kv namespace create SHORT_LINKS
# 记下输出中的 id

# 4. 更新 wrangler.toml 中的 KV 命名空间 ID
# 编辑 [[kv_namespaces]] 下的 id 字段

# 5. 上传中文字体到 KV（可选，用于中日韩文本支持）
# 子集化一个 TTF 字体（如 Arial Unicode MS）到 GB2312 + 标点：
#   pyftsubset --no-hinting --unicodes-file=your-unicode-list.txt ArialUnicode.ttf \
#     --output-file=subset.ttf
npx wrangler kv key put "font:arial-unicode-cn-gb2312" \
  --namespace-id 你的KV_ID --path subset.ttf --remote

# 同时上传基础拉丁字体：
npx wrangler kv key put "font:arial-sans" \
  --namespace-id 你的KV_ID --path path/to/arial.ttf --remote

# 6. 部署
npx wrangler deploy
```

你的端点将在 `https://<your-worker>.<your-subdomain>.workers.dev/mcp` 上线。

### 自定义域名（可选）

在 `wrangler.toml` 中添加路由：

```toml
[[routes]]
pattern = "plot.yourdomain.com/*"
zone_name = "yourdomain.com"
```

然后添加 DNS 记录指向你的 Worker。

---

## Showcase

### 1. 三角函数组合

sin、cos 及其合成——自动检测 π 模式 x 轴、三角 y 轴特殊刻度 `[-1, -0.5, 0, 0.5, 1]`、自动外置图例。

![三角函数组合](docs/showcase/cn/01_trig_composition.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "cos(x)", "sin(x)+cos(x)"],
  "labels": ["sin(x)", "cos(x)", "sin(x) + cos(x)"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "三角函数组合"
}}
```

---

### 2. 方波——傅里叶级数逼近

逐步叠加奇次谐波逼近方波。4 条曲线、自动 π 轴、数学预设布局。

![傅里叶逼近](docs/showcase/cn/02_fourier_approx.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "sin(x)+sin(3*x)/3", "sin(x)+sin(3*x)/3+sin(5*x)/5", "sin(x)+sin(3*x)/3+sin(5*x)/5+sin(7*x)/7"],
  "labels": ["1 项", "2 项", "3 项", "4 项"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "方波——傅里叶级数逼近"
}}
```

---

### 3. tan(x)——不连续检测

自动渐近线断裂检测——无尖刺、无连接 ±∞ 的垂直线。引擎检测符号翻转 + 大 Δy 并断开路径。

![tan 不连续](docs/showcase/cn/03_tan_discontinuity.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "tan(x)",
  "x_min": -4.712, "x_max": 4.712,
  "title": "tan(x)——不连续检测"
}}
```

---

### 4. sinc 函数: sin(x)/x

经典信号处理函数，在 x=0 处自动处理可去奇点。

![sinc 函数](docs/showcase/cn/04_sinc_function.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)/x",
  "x_min": -15, "x_max": 15,
  "title": "sinc 函数: sin(x)/x"
}}
```

---

### 5. 1/(x²-1)——有理函数渐近线标注

x = ±1 处的垂直渐近线标记。引擎渲染极点间隙时无伪影尖刺。

![有理函数渐近线](docs/showcase/cn/05_rational_asymptotes.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "1/(x^2-1)",
  "x_min": -4, "x_max": 4,
  "title": "1/(x²-1)——有理函数",
  "annotations": [
    {"kind": "vertical_line", "x": -1, "label": "x = -1", "color": "#f87171"},
    {"kind": "vertical_line", "x":  1, "label": "x = 1",  "color": "#f87171"}
  ]
}}
```

---

### 6. 阻尼振荡: e^(-0.3x)·sin(2x)

指数衰减 × 三角函数——自动 nice 刻度，15 个单位范围内平滑渲染。

![阻尼振荡](docs/showcase/cn/06_damped_oscillation.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "exp(-0.3*x)*sin(2*x)",
  "x_min": 0, "x_max": 15,
  "title": "阻尼振荡: e^(-0.3x)·sin(2x)"
}}
```

---

### 7. |sin(x)|·cos(x)——整流乘积

绝对值复合——符号变化的非平凡波形。

![整流乘积](docs/showcase/cn/07_absolute_value.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "abs(sin(x))*cos(x)",
  "x_min": -10, "x_max": 10,
  "title": "|sin(x)|·cos(x)——整流乘积"
}}
```

---

### 8. 高斯混合模型

三个不同均值和方差的高斯分布。

![高斯混合](docs/showcase/cn/08_gaussian_mixture.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["exp(-x*x/2)/sqrt(2*3.14159)", "0.6*exp(-(x-2)*(x-2)/1.5)/sqrt(2*3.14159*1.5)", "0.4*exp(-(x+1.5)*(x+1.5)/0.8)/sqrt(2*3.14159*0.8)"],
  "labels": ["N(0,1)", "0.6·N(2,1.5)", "0.4·N(-1.5,0.8)"],
  "x_min": -6, "x_max": 8,
  "title": "高斯混合模型"
}}
```

---

### 9. 衰减正弦 + 全标注套件

区域着色、点标记、垂直线、文本标签——一张图内展示所有标注类型。

![标注峰值](docs/showcase/cn/09_annotated_peaks.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)*exp(-0.1*x)",
  "x_min": 0, "x_max": 20,
  "title": "衰减正弦 + 全标注",
  "annotations": [
    {"kind": "area", "x_min": 0.8, "x_max": 2.2, "label": "第1峰值区", "color": "#60a5fa", "opacity": 0.12},
    {"kind": "area", "x_min": 7.0, "x_max": 8.5, "label": "第2峰值区", "color": "#34d399", "opacity": 0.12},
    {"kind": "point", "x": 1.471, "y": 0.859, "label": "峰值 1", "color": "#fbbf24"},
    {"kind": "point", "x": 7.754, "y": 0.458, "label": "峰值 2", "color": "#fbbf24"},
    {"kind": "vertical_line", "x": 6.93, "label": "半衰期 ≈ 6.93", "color": "#f87171"}
  ]
}}
```

---

### 10. Q1-Q4 营收预测 vs 实际

预测 vs 实际 vs 目标——散点图上的对称误差条、外置清晰图例。

![业务误差条](docs/showcase/cn/10_business_error_bars.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "Q1-Q4 营收预测 vs 实际",
  "xlabel": "季度", "ylabel": "营收 (百万美元)",
  "series": [
    {"name": "预测", "type": "line+scatter", "points": [[1,120],[2,185],[3,310],[4,490]], "color": "#60a5fa", "error": [8,12,20,35]},
    {"name": "实际", "type": "line+scatter", "points": [[1,135],[2,178],[3,345],[4,510]], "color": "#f87171", "error": [5,10,15,25]},
    {"name": "目标", "type": "line",         "points": [[1,150],[2,200],[3,300],[4,450]], "color": "#34d399"}
  ]
}}
```

---

### 11. 性能基准测试

3 个模型 × 4 项测试——每根柱的误差条、自动分类标签。

![分组柱状](docs/showcase/cn/11_grouped_bars.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "性能基准测试",
  "xlabel": "测试", "ylabel": "分数",
  "bar_style": "grouped",
  "series": [
    {"name": "模型 A", "type": "bar", "points": [[0,92],[1,78],[2,85],[3,95]], "group": "g", "color": "#60a5fa", "error": [2,3,2,1]},
    {"name": "模型 B", "type": "bar", "points": [[0,88],[1,82],[2,91],[3,87]], "group": "g", "color": "#f87171", "error": [3,2,1,2]},
    {"name": "模型 C", "type": "bar", "points": [[0,95],[1,74],[2,79],[3,90]], "group": "g", "color": "#34d399", "error": [1,4,3,2]}
  ]
}}
```

---

### 12. 云基础设施成本——堆叠

计算、存储、网络按月堆叠。

![堆叠柱状](docs/showcase/cn/12_stacked_bars.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "云基础设施成本——堆叠",
  "xlabel": "月份", "ylabel": "成本 ($)",
  "bar_style": "stacked",
  "series": [
    {"name": "计算", "type": "bar", "points": [[1,3200],[2,3500],[3,4100],[4,4800],[5,5200],[6,5600]], "group": "g", "color": "#60a5fa"},
    {"name": "存储", "type": "bar", "points": [[1,1200],[2,1400],[3,1600],[4,1900],[5,2200],[6,2500]], "group": "g", "color": "#34d399"},
    {"name": "网络", "type": "bar", "points": [[1,800],[2,900],[3,1100],[4,1300],[5,1500],[6,1800]], "group": "g", "color": "#fbbf24"}
  ]
}}
```

---

### 13. AI 研究团队时间分配

带百分比标签的饼图。

![饼图](docs/showcase/cn/13_pie_chart.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "AI 研究团队时间分配",
  "series": [{"type": "pie", "name": "team", "labels": ["训练","数据准备","评估","基础设施","会议","研究"], "values": [35,20,15,12,8,10]}]
}}
```

---

### 14. 响应延迟分布

自动分箱的直方图。

![直方图](docs/showcase/cn/14_histogram.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "响应延迟分布",
  "xlabel": "延迟", "ylabel": "频次",
  "series": [{"type": "hist", "name": "latency", "data": [12,15,18,22,25,28,30,32,35,38,41,45,48,52,55,58,62,65,68,72,75,78,82,85,88,92,95,98,102,105,108,112,115,118,122,125,128,132,135,138,142,145,148,152,155,158,162], "bins": 10}]
}}
```

---

### 15. 模型精度跨数据集对比

箱线图——中位数、四分位、须线、离群值。

![箱线图](docs/showcase/cn/15_box_plot.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "模型精度跨数据集对比",
  "ylabel": "精度 (%)",
  "series": [
    {"type": "box", "name": "GPT-4",  "data": [82,85,87,89,90,91,92,93,94,95,97]},
    {"type": "box", "name": "Claude", "data": [80,84,86,88,90,91,92,93,95,96,98]},
    {"type": "box", "name": "Gemini", "data": [75,79,83,85,87,89,90,92,93,94,96]}
  ]
}}
```

---

### 16. 训练损失（对数坐标）

10 个 epoch 的训练损失——y 轴自动切换为对数刻度格式。

![对数坐标](docs/showcase/cn/16_log_scale.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "训练损失（对数坐标）",
  "xlabel": "Epoch", "ylabel": "Loss",
  "y_scale": "log",
  "series": [{"name": "Loss", "type": "line", "points": [[1,2.5],[2,1.8],[3,0.95],[4,0.42],[5,0.18],[6,0.072],[7,0.031],[8,0.014],[9,0.006],[10,0.003]], "color": "#a78bfa"}]
}}
```

---

### 17. 实验测量——非对称不确定度

不确定度不对称的实验数据——`error: { plus: [...], minus: [...] }`。

![非对称误差散点](docs/showcase/cn/17_scatter_asymmetric.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "实验测量——非对称不确定度",
  "xlabel": "温度 (K)", "ylabel": "电导率 (S/m)",
  "series": [{"name": "测量值", "type": "scatter", "points": [[200,0.12],[250,0.28],[300,0.45],[350,0.67],[400,0.88],[450,1.05],[500,1.22]], "color": "#f472b6", "error": {"plus": [0.02,0.03,0.05,0.08,0.06,0.04,0.03], "minus": [0.01,0.02,0.03,0.05,0.04,0.03,0.02]}}]
}}
```

---

### 18. 变换管线：原始 → 平滑 → 归一化

同一组噪声数据的三种视图：原始散点、平滑折线（窗口=3）、min-max 归一化。

![变换管线](docs/showcase/cn/18_transform_pipeline.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "变换管线：原始 → 平滑 → 归一化",
  "xlabel": "样本", "ylabel": "值",
  "series": [
    {"name": "原始",   "type": "scatter", "points": [[0,2.1],[1,8.3],[2,4.5],[3,12.1],[4,6.2],[5,15.8],[6,9.1],[7,3.2],[8,11.5],[9,7.8],[10,14.2],[11,5.5]], "color": "#475569"},
    {"name": "平滑",   "type": "line",    "points": [[0,2.1],[1,8.3],[2,4.5],[3,12.1],[4,6.2],[5,15.8],[6,9.1],[7,3.2],[8,11.5],[9,7.8],[10,14.2],[11,5.5]], "color": "#60a5fa", "transforms": [{"type": "smooth", "window": 3}]},
    {"name": "归一化", "type": "line",    "points": [[0,2.1],[1,8.3],[2,4.5],[3,12.1],[4,6.2],[5,15.8],[6,9.1],[7,3.2],[8,11.5],[9,7.8],[10,14.2],[11,5.5]], "color": "#f472b6", "transforms": [{"type": "normalize", "method": "minmax"}]}
  ]
}}
```

---

### 19. 函数画廊

2×2 子图网格——四种不同图表类型，共享图例外置。

![子图 2×2](docs/showcase/cn/19_subplot_2x2.png)

```json
{"tool": "multi_plot", "arguments": {
  "title": "函数画廊",
  "rows": 2, "cols": 2,
  "plots": [
    {"row": 0, "col": 0, "title": "sin(x)",    "series": [{"type": "line",    "name": "sin(x)",   "points": [[-3.14,0],[-1.57,-1],[0,0],[1.57,1],[3.14,0]],  "color": "#60a5fa"}]},
    {"row": 0, "col": 1, "title": "x²",         "series": [{"type": "line",    "name": "x²",       "points": [[-3,9],[-2,4],[-1,1],[0,0],[1,1],[2,4],[3,9]],   "color": "#f87171"}]},
    {"row": 1, "col": 0, "title": "exp(-x)",    "series": [{"type": "line",    "name": "exp(-x)",  "points": [[-2,7.39],[-1,2.72],[0,1],[1,0.37],[2,0.14]],    "color": "#34d399"}]},
    {"row": 1, "col": 1, "title": "log(x)",     "series": [{"type": "scatter", "name": "log(x)",   "points": [[0.1,-2.3],[0.5,-0.69],[1,0],[2,0.69],[5,1.6]], "color": "#fbbf24"}]}
  ]
}}
```

---

### 20. ∫₀³ (x² - x + 1) dx

内置教学模块：积分区域着色、公式、上下界标注。

![定积分教学](docs/showcase/cn/20_teaching_integral.png)

```json
{"tool": "teaching", "arguments": {
  "topic": "definite_integral",
  "params": {"expr": "x^2 - x + 1", "a": 0, "b": 3},
  "title": "∫₀³ (x² - x + 1) dx"
}}
```

---

## 功能特性

### 图表类型

| 类型 | 工具 | 输入 |
|------|------|------|
| **函数图** | `plot_png_link` | 表达式字符串（`"sin(x)"`、`"1/(x^2-1)"`） |
| **多函数** | `plot_multi` | 表达式数组 |
| **数据系列** | `plot_series` | 显式 `[[x,y], ...]` 数据点 |
| **柱状图** | `plot_series` 或 `plot_bar` | 分组或堆叠 |
| **直方图** | `plot_series` | 原始数据数组 + 分箱数 |
| **箱线图** | `plot_series` | 每组原始数据 |
| **饼图** | `plot_series` | 标签 + 值 |
| **子图网格** | `multi_plot` | M×N 网格，任意图表类型 |
| **教学模板** | `teaching` | 定积分、导数、傅里叶级数、抛体运动等 |
| **示意图** | `diagram` | 受力图、电路图、韦恩图 |

### 坐标轴引擎

- **Nice 刻度**：从 1, 2, 2.5, 5 × 10ⁿ 中选择步长——不会出现 0.72 或 1.2 这样难看的值
- **自动 π 模式**：三角函数自动获得 π 格式 x 轴（`-2π, -π, 0, π, 2π`）
- **三角 y 轴特殊刻度**：sin/cos 获得 `[-1, -0.5, 0, 0.5, 1]` 而非任意小数
- **零对称**：数学风格的函数图默认 y 轴围绕零对称
- **对数刻度**：设置 `y_scale: "log"` 启用对数 y 轴
- **不连续检测**：符号翻转 + 大 Δy → 路径断开，渐近线处无垂直尖刺

### 标注

为图表添加视觉上下文：

```json
"annotations": [
  {"kind": "vertical_line", "x": 3.14, "label": "π", "color": "#f87171"},
  {"kind": "point", "x": 5.5, "y": 0.58, "label": "峰值", "color": "#fbbf24"},
  {"kind": "area", "x_min": 4, "x_max": 7, "label": "区域", "color": "#60a5fa", "opacity": 0.15}
]
```

### 误差条

支持三种格式：

```json
"error": [2, 3, 2, 1]                          // 每点对称
"error": 5                                      // 全局常数
"error": {"plus": [0.02,0.03], "minus": [0.01,0.02]}  // 非对称
```

### 数据变换

数据系列管线变换：

```json
"transforms": [
  {"type": "smooth", "window": 5},
  {"type": "normalize", "method": "minmax"},
  {"type": "normalize", "method": "zscore"},
  {"type": "rolling_avg", "window": 3}
]
```

### 视觉设计

- **默认暗色主题**：`#0f172a` 卡片背景、`#111827` 绘图区域、`#334155` 网格
- **图例外置**：右侧预留空间，永不遮挡数据
- **画布预设**：数学布局 (1000×720) 用于函数图、报告布局 (1200×720) 用于数据图表
- **中文支持**：7500+ 字形（GB2312 + 标点 + 数学符号），通过文本转路径管线渲染
- **调色板**：`#60a5fa, #f87171, #34d399, #fbbf24, #a78bfa, #22d3ee, #fb923c, #f472b6`

### 表达式语法

基于 [expr-eval](https://github.com/silentmatt/expr-eval)：

- 函数：`sin`、`cos`、`tan`、`exp`、`log`、`sqrt`、`abs`、`floor`、`ceil`、`round`
- 常量：`pi`、`e`
- 运算符：`+`、`-`、`*`、`/`、`^`（幂）、`%`（取模）
- 示例：`sin(x)`、`exp(-0.3*x)*cos(2*x)`、`1/(x^2-1)`、`abs(sin(x))*cos(x)`

---

## 架构

```
客户端 (AI Agent)
    │
    ▼
┌─────────────────────────────┐
│   Cloudflare Worker         │
│                             │
│  MCP 端点 (/mcp)            │◄── JSON-RPC 工具调用
│         │                   │
│         ▼                   │
│  Spec 规范化                 │    输入 → PlotSpec
│         │                   │
│         ▼                   │
│  SVG 生成                    │    纯字符串模板
│         │                   │
│         ▼                   │
│  中文文本转路径               │    opentype.js（字体从 KV 加载）
│         │                   │
│         ▼                   │
│  PNG 光栅化                  │    resvg-wasm
│         │                   │
│         ▼                   │
│  KV 短链存储                 │    5 分钟 TTL
│                             │
└─────────────────────────────┘
    │
    ▼
  PNG URL → 客户端
```

无需无头浏览器。无外部存储。一切运行在单个 Cloudflare Worker + KV 中。

### 包大小

- Worker 打包：~1 MB gzip（远低于 CF 免费版 3 MB 限制）
- 中文字体：2.5 MB，存储在 KV 中（首次请求时加载，缓存在 Worker 内存中）

---

## MCP 工具参考

| 工具 | 说明 | 关键参数 |
|------|------|----------|
| `plot` / `plot_png_link` | 单表达式图表 | `expr`、`title`、`x_min`、`x_max`、`annotations` |
| `plot_multi` | 多表达式叠加 | `exprs[]`、`labels[]`、`title` |
| `plot_series` | 数据驱动图表 | `series[]`，含 `type`、`points`、`color`、`error` |
| `plot_bar` | 快速柱状图 | `categories[]`、`values[]`、`title` |
| `multi_plot` | 子图网格 | `rows`、`cols`、`plots[]` |
| `teaching` | 数学教学模板 | `topic`：`definite_integral`、`derivative_tangent`、`fourier_series`、`projectile`、`simple_harmonic`、`energy_conservation`、`rc_circuit`、`parabola` |
| `analysis` | 统计分析 | `action`：`describe`、`corr`、`groupby` |
| `force_diagram_link` | 物理受力图 | 物体、连接器、接触面 |
| `circuit_diagram_link` | 电路示意图 | 元件、导线 |
| `venn_diagram_link` | 韦恩图 | 集合（标签 + 值） |
| `c_memory_diagram_link` | C 语言内存布局 | 变量、指针、数组 |

---

## 许可证

MIT
