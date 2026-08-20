#!/usr/bin/env bash
# 最小 CLI 示例：创建 Experiment 并运行
# 注意：baseline 路径请换成你自己的仓库路径

BASELINE="/path/to/your/repo"

node lib/cli.js create \
  --prompt "fix the sum function" \
  --baseline "$BASELINE" \
  --branch-a '{"id":"a","label":"run all","evaluator":{"command":"node run-all.mjs","regexAssertions":["FAILURE_DETECTED"]}}' \
  --branch-b '{"id":"b","label":"run partial","evaluator":{"command":"node run-partial.mjs","regexAssertions":["ok"]}}'

# 返回实验 id 后执行：
# node lib/cli.js run <id>