# Docker 镜像环境 — 快速启动指南

> 模块: `docker/` | 分支: `specs/101-dockerfile` | 最后更新: 2026-05-12

## 前置条件

- Docker 20.10+ (with BuildKit enabled: `DOCKER_BUILDKIT=1`)
- Docker Compose v2 (`docker compose` subcommand, not `docker-compose`)
- 项目根目录存在 `package.json` 和 `tsconfig.json`

## 快速开始

### 1. 构建并启动

```bash
# 在项目根目录执行
docker compose -f docker/docker-compose.yml up --build
```

首次构建约需 2-3 分钟。terminal 输出类似：

```
[+] Building 120.0s (15/15) FINISHED
[+] Running 1/1
 ✔ Container llm-router  Started
```

### 2. 验证服务

```bash
# 健康检查
curl http://localhost:11411/health

# 预期响应: 200 OK
```

### 3. 停止服务

```bash
docker compose -f docker/docker-compose.yml down
```

## 自定义配置

### 提供后端路由配置

编辑 `docker/config.json`：

```json
{
  "listening_port": 11411,
  "aliases": {
    "gpt-4": "gpt-4-turbo"
  },
  "backends": [
    {
      "name": "openai",
      "base_url": "https://api.openai.com/v1",
      "prefix": "openai",
      "default": true,
      "require_api_key": true,
      "key_env_var": "OPENAI_API_KEY"
    }
  ]
}
```

修改后重启容器使配置生效：

```bash
docker compose -f docker/docker-compose.yml restart
```

### 注入 API 密钥

在 `docker/docker-compose.yml` 的 `services.llm-router` 下添加：

```yaml
environment:
  - OPENAI_API_KEY=sk-your-key-here
  - LLMROUTER_API_KEY=your-router-key
```

或创建 `docker/.env` 文件并通过 `env_file` 引用：

```yaml
env_file:
  - .env
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `docker compose -f docker/docker-compose.yml up --build` | 构建并启动（前台） |
| `docker compose -f docker/docker-compose.yml up -d --build` | 构建并启动（后台） |
| `docker compose -f docker/docker-compose.yml down` | 停止并删除容器 |
| `docker compose -f docker/docker-compose.yml restart` | 重启容器（应用新配置） |
| `docker compose -f docker/docker-compose.yml logs -f` | 查看实时日志 |
| `docker compose -f docker/docker-compose.yml build --no-cache` | 强制重构建（不使用缓存） |
| `docker compose -f docker/docker-compose.yml exec llm-router sh` | 进入容器 shell |

## 镜像大小检查

```bash
docker images fellow99/llm-router --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

预期输出：

```
REPOSITORY            TAG       SIZE
fellow99/llm-router   latest    ~150MB
```

## 故障排查

### 构建失败

```bash
# 查看完整构建日志
docker compose -f docker/docker-compose.yml build --no-cache --progress=plain
```

### 端口冲突

```bash
# 检查 11411 端口占用
lsof -i :11411

# 修改 docker-compose.yml 中的宿主机端口
# ports:
#   - "11412:11411"  # 改为其他端口
```

### 容器启动后立即退出

```bash
# 查看退出日志
docker compose -f docker/docker-compose.yml logs
```

常见原因：
- `config.json` JSON 格式错误 → Zod 校验失败
- 缺少必需环境变量 → 服务进程退出
