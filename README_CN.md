# plot-mcp-worker

无服务器图表渲染引擎。运行在 Cloudflare Workers 上，通过 MCP 协议输出 PNG/SVG。

运行时零依赖。无头浏览器。纯 SVG → PNG（resvg-wasm）。

---

## 效果展示

### 1. 三角函数组合

sin、cos 及其叠加——自动检测 π 轴模式，y 轴 trig 专用刻度 `[-1, -0.5, 0, 0.5, 1]`，图例自动外置。

![三角函数组合](docs/showcase/cn/01_trig_composition.png)

```json
{"tool": "plot_multi", "arguments": {
  "exprs": ["sin(x)", "cos(x)", "sin(x)+cos(x)"],
  "labels": ["sin(x)", "cos(x)", "sin(x) + cos(x)"],
  "x_min": -6.283, "x_max": 6.283,
  "title": "Trigonometric Composition"
}}
```

---

### 2. 方波——傅里叶级数逼近

逐级叠加奇次谐波逼近方波。4 条曲线，自动 π 轴。

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

自动检测渐近线断点——无尖刺、无连接 ±∞ 的垂直线。引擎检测符号翻转 + 大 Δy 后自动断开路径。

![tan 不连续](docs/showcase/cn/03_tan_discontinuity.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "tan(x)",
  "x_min": -4.712, "x_max": 4.712,
  "title": "tan(x)——不连续检测"
}}
```

---

### 4. sinc(x) = sin(x)/x

经典信号处理函数，x=0 处的可去奇点自动处理。

![sinc 函数](docs/showcase/cn/04_sinc_function.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)/x",
  "x_min": -15, "x_max": 15,
  "title": "sinc(x) = sin(x)/x"
}}
```

---

### 5. 1/(x²-1)——有理函数 + 渐近线标注

x = ±1 处的垂直渐近线标注。引擎正确渲染极点间断，无伪影尖刺。

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

### 6. 阻尼振荡

指数衰减 × 三角函数——自动规整刻度，15 个单位宽度内平滑渲染。

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

绝对值组合——非平凡波形与符号变化。

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

三个不同均值和方差的高斯分布——正态分布渲染。

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

### 9. 全标注套件

区域着色、点标记、垂直线、文字标签——四种标注类型一图打尽。

![标注峰值](docs/showcase/cn/09_annotated_peaks.png)

```json
{"tool": "plot_png_link", "arguments": {
  "expr": "sin(x)*exp(-0.1*x)",
  "x_min": 0, "x_max": 20,
  "title": "衰减正弦 + 全标注",
  "annotations": [
    {"kind": "area", "x_min": 4.5, "x_max": 7.5, "label": "第1峰值区", "color": "#60a5fa", "opacity": 0.15},
    {"kind": "area", "x_min": 11, "x_max": 14, "label": "第2峰值区", "color": "#34d399", "opacity": 0.15},
    {"kind": "point", "x": 5.5, "y": 0.58, "label": "Peak 1", "color": "#fbbf24"},
    {"kind": "point", "x": 12, "y": 0.30, "label": "Peak 2", "color": "#fbbf24"},
    {"kind": "vertical_line", "x": 10, "label": "半衰期 ≈ 10", "color": "#f87171"}
  ]
}}
```

---

### 10. 多系列业务图 + 误差条

预测 vs 实际 vs 目标——散点图上非对称误差条，图例外置不遮挡数据。

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

### 11. 分组柱状图 + 误差条

3 个模型 × 4 项测试——每根柱子带独立误差条。

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

### 12. 堆叠柱状图

云成本分解——计算、存储、网络按月堆叠。

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

### 13. 饼图

团队时间分配——环形饼图 + 百分比标签。

![饼图](docs/showcase/cn/13_pie_chart.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "AI 研究团队时间分配",
  "series": [{"type": "pie", "name": "团队", "labels": ["训练","数据准备","评估","基础设施","会议","研究"], "values": [35,20,15,12,8,10]}]
}}
```

---

### 14. 直方图

响应延迟分布——自动分箱，柱顶显示频次。

![直方图](docs/showcase/cn/14_histogram.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "响应延迟分布",
  "xlabel": "延迟", "ylabel": "频次",
  "series": [{"type": "hist", "name": "延迟", "data": [12,15,18,22,25,28,30,32,35,38,41,45,48,52,55,58,62,65,68,72,75,78,82,85,88,92,95,98,102,105,108,112,115,118,122,125,128,132,135,138,142,145,148,152,155,158,162], "bins": 10}]
}}
```

---

### 15. 箱线图

模型精度对比——中位数、四分位、须线、离群值。

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

### 16. 对数坐标

训练损失 10 轮——y 轴自动切换对数刻度格式。

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

### 17. 散点图 + 非对称误差条

实验测量数据，上下不确定度不同——`error: { plus: [...], minus: [...] }`。

![非对称误差](docs/showcase/cn/17_scatter_asymmetric.png)

```json
{"tool": "plot_series", "arguments": {
  "title": "实验测量——非对称不确定度",
  "xlabel": "温度 (K)", "ylabel": "电导率 (S/m)",
  "series": [{"name": "测量值", "type": "scatter", "points": [[200,0.12],[250,0.28],[300,0.45],[350,0.67],[400,0.88],[450,1.05],[500,1.22]], "color": "#f472b6", "error": {"plus": [0.02,0.03,0.05,0.08,0.06,0.04,0.03], "minus": [0.01,0.02,0.03,0.05,0.04,0.03,0.02]}}]
}}
```

---

### 18. 变换管线——原始 → 平滑 → 归一化

同一组噪声数据的三种视角：原始散点、平滑线（窗口=3）、min-max 归一化。

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

### 19. 2×2 子图网格

四种不同图表类型——折线、散点、函数——共享图例外置。

![子图网格](docs/showcase/cn/19_subplot_2x2.png)

```json
{"tool": "multi_plot", "arguments": {
  "title": "函数画廊",
  "rows": 2, "cols": 2,
  "plots": [
    {"row": 0, "col": 0, "title": "sin(x)",   "series": [{"type": "line",    "name": "sin(x)",  "points": [[-3.14,0],[-1.57,-1],[0,0],[1.57,1],[3.14,0]],  "color": "#60a5fa"}]},
    {"row": 0, "col": 1, "title": "x²",        "series": [{"type": "line",    "name": "x²",      "points": [[-3,9],[-2,4],[-1,1],[0,0],[1,1],[2,4],[3,9]],   "color": "#f87171"}]},
    {"row": 1, "col": 0, "title": "exp(-x)",   "series": [{"type": "line",    "name": "exp(-x)", "points": [[-2,7.39],[-1,2.72],[0,1],[1,0.37],[2,0.14]],    "color": "#34d399"}]},
    {"row": 1, "col": 1, "title": "log(x)",    "series": [{"type": "scatter", "name": "log(x)",  "points": [[0.1,-2.3],[0.5,-0.69],[1,0],[2,0.69],[5,1.6]], "color": "#fbbf24"}]}
  ]
}}
```

---

### 20. 教学模板——定积分

内置教学模块：积分区域着色、公式、上下限标注。

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

### 渲染
- 纯 SVG → PNG（resvg-wasm，无头浏览器，无 puppeteer）
- 深色主题一等公民：`#0f172a` 卡片、`#111827` 绘图区、`#334155` 网格
- 图表类型：折线、散点、折线+散点、柱状、分组柱状、堆叠柱状、直方图、箱线图、饼图
- 多图子图网格（M × N），共享图例
- 误差条（对称数组 / 常量 / 非对称 `{plus, minus}`），支持折线、散点、柱状
- 标注：垂直线、点标记、文字标签、区域着色

### 坐标轴引擎 (v0.4.13)
- **规整刻度**：步长从 1, 2, 2.5, 5 × 10ⁿ 中选取——不再出现 0.72 或 1.2 这种丑数
- **自动 π 模式**：三角函数自动获得 π 格式 x 轴
- **三角 y 轴专用**：sin/cos 直接用 `[-1, -0.5, 0, 0.5, 1]`，不用任意小数
- **零对称**：数学风格函数图默认 y 轴零对称
- **不连续检测**：符号翻转 + 大 Δy → 路径断开（无垂直尖刺）
- **语义意图系统**：LLM 建议语义模式，引擎控制几何

### 数学
- 表达式解析器（expr-eval）：`sin(x)`、`exp(-0.3*x)*cos(2*x)`、`1/(x^2-1)`
- 分段函数
- 每系列最多 20,000 点
- 变换管线：归一化（minmax/zscore/maxabs）、平滑、过滤、滚动平均、降采样

### MCP 工具

| 工具 | 说明 |
|------|------|
| `plot` / `plot_png_link` | 单表达式——自动 π、三角检测、不连续处理 |
| `plot_multi` | 多表达式叠加 |
| `plot_series` | 显式数据数组——折线/散点/柱状/直方图/箱线图/饼图 + 误差条 |
| `plot_bar` | 柱状图快捷方式 |
| `multi_plot` | M×N 子图网格，共享图例 |
| `analysis` | 统计分析：描述、相关、分组 |
| `teaching` | 教学模板：定积分、切线/导数、傅里叶级数、抛体运动、简谐运动、能量守恒、RC/RLC 电路、抛物线 |
| `diagram` | 力学图、电路图、韦恩图 |
| `geometry_3d` | 3D 形状渲染 |

### 设计
- 图例外置（右侧预留空间）——永远不遮挡数据
- 数学预设 (1000×720) vs 报表预设 (1200×720)
- 线条光晕 0.30 透明度——可读但用户感知不到
- 字体：系统 sans-serif，内嵌 PingFang SC 子集支持中文

## 部署

```bash
npx wrangler deploy
```

需要 Cloudflare Workers + KV 命名空间（用于短链 PNG URL）。

## 许可证

MIT
