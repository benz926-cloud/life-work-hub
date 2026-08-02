#!/usr/bin/env bash
# ============================================================================
# 归属守卫 —— 机械执行 AGENTS.md 第 1 节的「按层分工」铁律
#
# 用法：
#   bash scripts/check-ownership.sh                 # 本地：对比 origin/main
#   BASE_REF=origin/feat/supabase-auth bash scripts/check-ownership.sh
#   FILES="a.ts b.tsx" BRANCH_NAME=feat/ui-polish bash scripts/check-ownership.sh  # 测试用
#
# 豁免：OVERRIDE_OWNERSHIP=1（CI 里由 PR 的 override-ownership 标签置位）
# ============================================================================
set -uo pipefail

BASE="${BASE_REF:-origin/main}"
BRANCH="${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"

# ---- 归属表（与 AGENTS.md 第 1 节保持一致，改这里也要改那里）----------------
# src/types 是共享契约：允许改（只增不改），但会单独提醒并要求同步 WorkBuddy
SHARED_ALLOW=("README.md" "AGENTS.md" "CLAUDE.md" ".gitignore" "docs/*" "src/types/*")

case "$BRANCH" in
  *ai-pipeline*)
    OWNER="Claude"
    ALLOW=("src/lib/ai/*" "src/hooks/*" "src/app/api/*" "scripts/*")
    HINT="业务逻辑层。视图改动请交给 Codex 在 feat/ui-polish 做。"
    ;;
  *ui-polish*)
    OWNER="Codex"
    ALLOW=("src/components/*" "src/app/globals.css" "public/*")
    HINT="视图与交互层。业务逻辑请交给 Claude 在 feat/ai-pipeline 做，组件里只调 @/hooks。"
    ;;
  *)
    echo "✅ 分支「$BRANCH」不受层归属限制（WorkBuddy 维护范围）"
    exit 0
    ;;
esac

# ---- 取改动文件 -------------------------------------------------------------
if [ -n "${FILES:-}" ]; then
  CHANGED="$FILES"
else
  if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
    echo "⚠️  找不到基线 $BASE，跳过归属检查（本地请先 git fetch origin）"
    exit 0
  fi
  CHANGED="$(git diff --name-only "$BASE"...HEAD)"
fi

if [ -z "$CHANGED" ]; then
  echo "✅ 无改动文件"
  exit 0
fi

# ---- 逐个比对 ---------------------------------------------------------------
violations=()
notes=()

for f in $CHANGED; do
  ok=0
  for p in "${SHARED_ALLOW[@]}" "${ALLOW[@]}"; do
    # shellcheck disable=SC2254
    case "$f" in $p) ok=1; break ;; esac
  done
  [ "$ok" -eq 1 ] || violations+=("$f")
  # 共享契约：能改，但要提醒
  case "$f" in src/types/*) notes+=("$f") ;; esac
done

echo "分支：$BRANCH　负责人：$OWNER　基线：$BASE"
echo "改动文件 $(echo "$CHANGED" | wc -w | tr -d ' ') 个"

if [ "${#notes[@]}" -gt 0 ]; then
  echo ""
  echo "ℹ️  共享契约被改动，请确认是「只增不改」，并同步 WorkBuddy："
  printf '   · %s\n' "${notes[@]}"
fi

if [ "${#violations[@]}" -eq 0 ]; then
  echo ""
  echo "✅ 归属检查通过，未越层"
  exit 0
fi

echo ""
echo "❌ 以下文件不属于 $OWNER 的层："
printf '   · %s\n' "${violations[@]}"
echo ""
echo "   $HINT"
echo "   允许的路径：${ALLOW[*]} ${SHARED_ALLOW[*]}"
echo ""
if [ "${OVERRIDE_OWNERSHIP:-0}" = "1" ]; then
  echo "⚠️  已通过 override-ownership 豁免，放行（请在 PR 描述里写明理由）"
  exit 0
fi
echo "   确需越界：给 PR 打 override-ownership 标签，并在描述里写明理由。"
exit 1
