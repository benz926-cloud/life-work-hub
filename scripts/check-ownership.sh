#!/usr/bin/env bash
# ============================================================================
# 归属守卫 —— 机械执行 AGENTS.md 第 1 节的「按层分工」铁律
#
# 用法：
#   bash scripts/check-ownership.sh                 # 本地：对比 origin/main
#   BASE_REF=origin/main bash scripts/check-ownership.sh
#   FILES="a.ts b.tsx" BRANCH_NAME=feat/ui-polish bash scripts/check-ownership.sh  # 测试用
#
# 豁免：OVERRIDE_OWNERSHIP=1（CI 里由 PR 的 override-ownership 标签置位）
#
# ── 可移植性注意（踩过的坑，别改回去）─────────────────────────────
# 1. 所有变量展开一律写成 ${VAR}。某些 bash 构建（如 macOS 自带 3.2、
#    或特定 locale 下的多字节处理）会把紧跟其后的全角字符（：　「）
#    吞进变量名，配合 set -u 直接报 "BRANCH：: unbound variable"。
# 2. 不使用可能为空的数组展开。bash 3.2 下 set -u + "${arr[@]}"（空数组）
#    同样报 unbound variable。这里改用换行分隔的字符串累加。
# 3. set -f 必须保留。归属表里的 docs/*、src/components/* 是给 case 用的匹配模式，
#    不开 noglob 的话它们会被 shell 按当前目录做路径展开，变成真实存在的文件名，
#    导致「明明允许的路径被判成越界」。
# ============================================================================
set -uo pipefail
set -f   # 关闭路径名展开，见上方注意事项 3

BASE="${BASE_REF:-origin/main}"
BRANCH="${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"

# ---- 归属表（与 AGENTS.md 第 1 节保持一致，改这里也要改那里）----------------
# src/types 是共享契约：允许改（只增不改），但会单独提醒并要求同步 WorkBuddy
SHARED_ALLOW="README.md AGENTS.md CLAUDE.md .gitignore docs/* src/types/*"

case "${BRANCH}" in
  *ai-pipeline*)
    OWNER="Claude"
    ALLOW="src/lib/ai/* src/hooks/* src/app/api/* scripts/*"
    HINT="业务逻辑层。视图改动请交给 Codex 在 feat/ui-polish 做。"
    ;;
  *ui-polish*)
    OWNER="Codex"
    ALLOW="src/components/* src/app/globals.css public/*"
    HINT="视图与交互层。业务逻辑请交给 Claude 在 feat/ai-pipeline 做，组件里只调 @/hooks。"
    ;;
  main|master|chore/*|fix/*|hotfix/*|release/*|revert/*)
    # WorkBuddy 的维护车道，不受层归属限制
    echo "✅ 分支「${BRANCH}」不受层归属限制（WorkBuddy 维护范围）"
    exit 0
    ;;
  *)
    # 关键：守卫不能 fail-open。
    # 归属表匹配不上就放行的话，随便起个新分支名就能让守卫静默失效
    # （feat/data-layer 踩过一次：4 个文件的改动被当成"不受限"直接过了）。
    echo "❌ 分支「${BRANCH}」没有声明归属层，无法执行检查。"
    echo ""
    echo "   三选一："
    echo "   1) 改用带归属的分支名：feat/ai-pipeline-*（Claude）/ feat/ui-polish-*（Codex）"
    echo "   2) 维护类改动用 chore/ fix/ hotfix/ release/ revert/ 前缀（WorkBuddy 车道）"
    echo "   3) 确实要开新条线：在本脚本的 case 里补规则，并同步 AGENTS.md 第 1 节"
    exit 1
    ;;
esac

# ---- 取改动文件 -------------------------------------------------------------
if [ -n "${FILES:-}" ]; then
  CHANGED="${FILES}"
else
  if ! git rev-parse --verify --quiet "${BASE}" >/dev/null; then
    echo "⚠️  找不到基线 ${BASE}，跳过归属检查（本地请先 git fetch origin）"
    exit 0
  fi
  CHANGED="$(git diff --name-only "${BASE}"...HEAD)"
fi

if [ -z "${CHANGED}" ]; then
  echo "✅ 无改动文件"
  exit 0
fi

# ---- 逐个比对 ---------------------------------------------------------------
violations=""
notes=""
count=0

for f in ${CHANGED}; do
  count=$((count + 1))
  ok=0
  for p in ${SHARED_ALLOW} ${ALLOW}; do
    # shellcheck disable=SC2254
    case "${f}" in ${p}) ok=1; break ;; esac
  done
  [ "${ok}" -eq 1 ] || violations="${violations}${f}"$'\n'
  case "${f}" in src/types/*) notes="${notes}${f}"$'\n' ;; esac
done

echo "分支：${BRANCH}"
echo "负责人：${OWNER}"
echo "基线：${BASE}"
echo "改动文件 ${count} 个"

if [ -n "${notes}" ]; then
  echo ""
  echo "ℹ️  共享契约被改动，请确认是「只增不改」，并同步 WorkBuddy："
  printf '%s' "${notes}" | sed 's/^/   · /'
fi

if [ -z "${violations}" ]; then
  echo ""
  echo "✅ 归属检查通过，未越层"
  exit 0
fi

echo ""
echo "❌ 以下文件不属于 ${OWNER} 的层："
printf '%s' "${violations}" | sed 's/^/   · /'
echo ""
echo "   ${HINT}"
echo "   允许的路径：${ALLOW} ${SHARED_ALLOW}"
echo ""
if [ "${OVERRIDE_OWNERSHIP:-0}" = "1" ]; then
  echo "⚠️  已通过 override-ownership 豁免，放行（请在 PR 描述里写明理由）"
  exit 0
fi
echo "   确需越界：给 PR 打 override-ownership 标签，并在描述里写明理由。"
exit 1
