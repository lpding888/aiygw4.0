#!/bin/bash

# Admin整链IT测试运行脚本
# 艹！这个脚本可以轻松运行所有Admin测试！
#
# @author 老王

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 打印分隔线
print_separator() {
    echo -e "${BLUE}================================================${NC}"
}

# 显示帮助信息
show_help() {
    cat << EOF
Admin整链IT测试运行脚本

用法: $0 [选项] [测试套件]

测试套件:
  user-management    用户管理测试
  pipeline-management Pipeline管理测试
  knowledge-base     知识库管理测试
  system-config      系统配置测试
  integration        集成测试
  all               运行所有测试（默认）

选项:
  -h, --help         显示帮助信息
  -e, --env ENV      设置测试环境 (development|staging|production)
  -b, --browser BROWSER 设置浏览器 (chromium|firefox|webkit)
  -h, --headless     无头模式运行
  -r, --retries NUM   重试次数 (默认: 1)
  -t, --timeout NUM   超时时间（秒，默认: 30）
  --debug            调试模式
  --ci               CI模式
  --update-snapshots  更新截图
  --report-only      只生成报告

示例:
  $0                              # 运行所有测试
  $0 user-management               # 只运行用户管理测试
  $0 -e staging --headless         # 在staging环境无头模式运行
  $0 -b firefox --retries 2        # 使用Firefox浏览器，重试2次

EOF
}

# 解析命令行参数
ENVIRONMENT="development"
BROWSER="chromium"
HEADLESS=false
RETRIES=1
TIMEOUT=30
DEBUG=false
CI=false
UPDATE_SNAPSHOTS=false
REPORT_ONLY=false
TEST_SUITE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        --headless)
            HEADLESS=true
            shift
            ;;
        -r|--retries)
            RETRIES="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --ci)
            CI=true
            shift
            ;;
        --update-snapshots)
            UPDATE_SNAPSHOTS=true
            shift
            ;;
        --report-only)
            REPORT_ONLY=true
            shift
            ;;
        user-management|pipeline-management|knowledge-base|system-config|integration)
            TEST_SUITE="$1"
            shift
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 设置环境变量
export TEST_ENV="$ENVIRONMENT"
export PWDEBUG="$DEBUG"
export CI="$CI"
export UPDATE_SNAPSHOTS="$UPDATE_SNAPSHOTS"

# 显示配置信息
print_separator
print_message "$BLUE" "🚀 Admin整链IT测试启动"
print_separator
print_message "$YELLOW" "测试环境: $ENVIRONMENT"
print_message "$YELLOW" "浏览器: $BROWSER"
print_message "$YELLOW" "无头模式: $HEADLESS"
print_message "$YELLOW" "重试次数: $RETRIES"
print_message "$YELLOW" "超时时间: ${TIMEOUT}秒"
print_message "$YELLOW" "测试套件: $TEST_SUITE"
print_separator

# 检查依赖
check_dependencies() {
    print_message "$BLUE" "🔍 检查测试依赖..."

    # 检查Node.js版本
    if ! command -v node &> /dev/null; then
        print_message "$RED" "❌ Node.js未安装"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_message "$RED" "❌ Node.js版本过低，需要v16+，当前版本: $(node -v)"
        exit 1
    fi

    # 检查npm包
    if [ ! -d "node_modules" ]; then
        print_message "$BLUE" "📦 安装依赖包..."
        npm install
    fi

    # 检查Playwright
    if ! command -v npx playwright &> /dev/null; then
        print_message "$RED" "❌ Playwright未安装"
        print_message "$BLUE" "📦 安装Playwright..."
        npx playwright install
    fi

    print_message "$GREEN" "✅ 依赖检查通过"
}

# 清理之前的测试结果
cleanup_results() {
    print_message "$BLUE" "🧹 清理之前的测试结果..."

    if [ -d "test-results" ]; then
        rm -rf test-results/*
    fi

    # 创建测试目录
    mkdir -p test-results/{screenshots,videos,traces,fixtures}

    print_message "$GREEN" "✅ 测试结果清理完成"
}

# 运行测试
run_tests() {
    local test_pattern="tests/e2e/admin/**/*.spec.ts"
    local project_opt=""

    # 根据测试套件设置测试模式
    case $TEST_SUITE in
        user-management)
            test_pattern="tests/e2e/admin/admin-user-management.spec.ts"
            ;;
        pipeline-management)
            test_pattern="tests/e2e/admin/admin-pipeline-management.spec.ts"
            ;;
        knowledge-base)
            test_pattern="tests/e2e/admin/admin-knowledge-base.spec.ts"
            ;;
        system-config)
            test_pattern="tests/e2e/admin/admin-system-config.spec.ts"
            ;;
        integration)
            test_pattern="tests/e2e/admin/admin-integration.spec.ts"
            ;;
    esac

    # 构建Playwright命令
    local playwright_cmd="npx playwright test"

    # 添加测试文件模式
    playwright_cmd="$playwright_cmd \"$test_pattern\""

    # 添加项目配置
    case $BROWSER in
        chromium)
            playwright_cmd="$playwright_cmd --project=chromium"
            ;;
        firefox)
            playwright_cmd="$playwright_cmd --project=firefox"
            ;;
        webkit)
            playwright_cmd="$playwright_cmd --project=webkit"
            ;;
    esac

    # 添加其他选项
    if [ "$HEADLESS" = true ]; then
        playwright_cmd="$playwright_cmd --headed=false"
    else
        playwright_cmd="$playwright_cmd --headed"
    fi

    if [ "$REPORT_ONLY" = true ]; then
        playwright_cmd="$playwright_cmd --reporter=html --reporter=json"
    fi

    if [ "$UPDATE_SNAPSHOTS" = true ]; then
        playwright_cmd="$playwright_cmd --update-snapshots"
    fi

    # 设置超时和重试
    export TIMEOUT="${TIMEOUT}000"
    export RETRIES="$RETRIES"

    print_message "$BLUE" "🧪 开始运行测试..."
    print_message "$YELLOW" "执行命令: $playwright_cmd"

    # 运行测试
    eval $playwright_cmd
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        print_message "$GREEN" "✅ 测试完成！"
    else
        print_message "$RED" "❌ 测试失败，退出码: $exit_code"
        return $exit_code
    fi
}

# 生成测试报告
generate_report() {
    print_message "$BLUE" "📊 生成测试报告..."

    if [ -d "test-results/html-report" ]; then
        print_message "$GREEN" "📁 HTML报告已生成: test-results/html-report/index.html"
    fi

    if [ -f "test-results/test-results.json" ]; then
        print_message "$GREEN" "📄 JSON报告已生成: test-results/test-results.json"
    fi

    if [ -f "test-results/test-summary.json" ]; then
        print_message "$GREEN" "📋 测试总结: test-results/test-summary.json"
    fi
}

# 显示测试结果摘要
show_results_summary() {
    print_separator
    print_message "$BLUE" "📊 测试结果摘要"
    print_separator

    if [ -f "test-results/test-summary.json" ]; then
        # 使用node.js解析JSON并显示摘要
        node -e "
            const summary = JSON.parse(require('fs').readFileSync('test-results/test-summary.json', 'utf8'));
            console.log('测试环境:', summary.environment);
            console.log('完成时间:', summary.timestamp);
            console.log('状态:', summary.status);

            if (summary.files) {
                console.log('截图数量:', summary.files.screenshots);
                console.log('视频数量:', summary.files.videos);
                console.log('跟踪数量:', summary.files.traces);
            }
        "
    else
        print_message "$YELLOW" "未找到测试结果文件"
    fi
}

# 主函数
main() {
    # 检查是否在正确的目录
    if [ ! -f "package.json" ]; then
        print_message "$RED" "❌ 请在项目根目录运行此脚本"
        exit 1
    fi

    # 检查依赖
    check_dependencies

    # 清理测试结果
    cleanup_results

    # 运行测试
    run_tests
    local test_exit_code=$?

    # 生成报告
    generate_report

    # 显示结果摘要
    show_results_summary

    # 返回测试结果
    if [ $test_exit_code -eq 0 ]; then
        print_separator
        print_message "$GREEN" "🎉 Admin整链IT测试全部通过！"
        print_separator
        exit 0
    else
        print_separator
        print_message "$RED" "💥 测试失败，请查看详细报告"
        print_separator
        exit $test_exit_code
    fi
}

# 运行主函数
main "$@"