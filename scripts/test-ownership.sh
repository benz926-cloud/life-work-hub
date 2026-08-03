#!/usr/bin/env bash
# ============================================================================
# 归属守卫的自测 —— 这个脚本自己被改坏过两次，所以给它加了回归测试
#   坑 1：全角冒号被吞进变量名（set -u 下直接 unbound variable）
#   坑 2：归属表里的 docs/* 被 shell 当路径通配符展开，导致合法路径被判越界
# 用法：bash scripts/test-ownership.sh
# ============================================================================
set -uo pipefail
S="$(dirname "$0")/check-ownership.sh"
pass=0; fail=0

# 用例格式：期望退出码 | 分支 | 改动文件 | 额外环境 | 说明
run_case() {
  local want="$1" branch="$2" files="$3" extra="$4" desc="$5"
  local out rc
  out="$(env ${extra} FILES="${files}" BRANCH_NAME="${branch}" bash "${S}" 2>&1)"; rc=$?
  if [ "${rc}" -eq "${want}" ]; then
    pass=$((pass + 1)); echo "  ✓ ${desc}"
  else
    fail=$((fail + 1)); echo "  ✗ ${desc}（期望 exit ${want}，实得 ${rc}）"; echo "${out}" | sed 's/^/      /'
  fi
}

echo "归属守卫回归测试"
run_case 0 feat/ai-pipeline "src/lib/ai/intent.ts src/hooks/useAI.ts docs/x.md scripts/y.sh" "" "Claude 改自己的层 + docs/ + scripts/ → 放行"
run_case 1 feat/ai-pipeline "src/components/inbox/InboxPage.tsx"                             "" "Claude 改组件 → 拦截"
run_case 0 feat/ui-polish   "src/components/a.tsx src/app/globals.css public/icons/x.png"    "" "Codex 改自己的层 → 放行"
run_case 1 feat/ui-polish   "src/lib/ai/content.ts"                                          "" "Codex 改引擎 → 拦截"
run_case 1 feat/ui-polish   "src/app/api/ai/route.ts"                                        "" "Codex 改 API 路由 → 拦截"
run_case 0 feat/ui-polish   "src/types/index.ts"                          "" "共享契约 → 放行但提醒"
run_case 0 feat/ui-polish   "src/lib/ai/content.ts"  "OVERRIDE_OWNERSHIP=1" "带豁免标签 → 放行"
run_case 0 main             "anything.ts"                                 "" "非受限分支 → 放行"
run_case 0 chore/whatever   "src/lib/ai/x.ts src/components/y.tsx"        "" "chore 分支 → 放行"
run_case 0 fix/login        "src/lib/auth/AuthContext.tsx"                 "" "fix 分支 → 放行"
run_case 0 feat/ai-pipeline-data "src/hooks/useData.ts scripts/seed.ts"   "" "带后缀的归属分支 → 正常判定"
run_case 1 feat/ai-pipeline-data "src/components/x.tsx"                   "" "带后缀的归属分支越界 → 拦截"
run_case 1 feat/dashboard   "README.md"                                   "" "未声明归属的新分支 → 拦截（不再 fail-open）"

# 多字节字符不会被吞进变量名（坑 1 的回归）
if env FILES="src/lib/ai/x.ts" BRANCH_NAME="feat/ai-pipeline" bash "${S}" 2>&1 | grep -q "unbound variable"; then
  fail=$((fail + 1)); echo "  ✗ 变量展开被全角字符污染（坑 1 复发）"
else
  pass=$((pass + 1)); echo "  ✓ 变量展开未被全角字符污染"
fi

echo ""
echo "通过 ${pass}　失败 ${fail}"
[ "${fail}" -eq 0 ] || exit 1
