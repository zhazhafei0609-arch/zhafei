# python-starter

A minimal Python project using the `src` layout and the standard library.

## Requirements

- Python 3.9 or newer

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

In PyCharm, select `.venv/bin/python` as the project interpreter.

## Run

```bash
python -m python_starter
```

Or, after installing the project:

```bash
python-starter
```

## Test

```bash
python -m unittest discover -s tests -v
```

For test discovery without installing the package, run:

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

## HTML 小游戏

项目包含一个无需构建的单人层叠三消小游戏“动物叠叠乐”：

```bash
python3 -m http.server 8000
```

访问 <http://localhost:8000/game/>，也可以直接打开 `game/index.html`。

玩法类似「羊了个羊」：点击未被遮挡的小动物，三个相同图案自动消除。游戏采用无限关卡模式，每关通过后都会显示赞美提示并继续生成更高难度的新关卡。关卡配置和 UI 替换说明见 `game/README.md`。

### 免费分享链接

游戏支持 PWA 离线运行，并附带 GitHub Pages 自动部署工作流。免费发布步骤见 `game/FREE_HOSTING.md`。
