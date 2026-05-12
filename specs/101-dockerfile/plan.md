# 创建镜像环境 (101) 技术方案

> 模块路径: `docker/`
> 生成时间: 2026-05-12

## 1. 技术架构

### 1.1 目录结构

```
docker/
├── Dockerfile              # 多阶段构建文件
├── docker-compose.yml      # 容器编排文件
├── .dockerignore           # 构建上下文忽略规则
└── config.json             # 配置模板（空 JSON 对象）
```

所有 Docker 相关文件集中在 `docker/` 目录，与项目源码（`src/`）和基础设施配置（`tsconfig.json`、`package.json`）完全分离。构建命令在项目根目录执行，通过 `-f docker/Dockerfile` 指定 Dockerfile 路径。

### 1.2 与现有模块的关系

```
项目根目录
├── src/               # TypeScript 源码（构建阶段输入）
├── dist/              # 编译产物（构建阶段输出 → 运行阶段输入）
├── package.json       # 依赖声明（两个阶段均依赖）
├── tsconfig.json      # TypeScript 编译配置（仅构建阶段使用）
├── docker/            # 容器化相关文件
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .dockerignore
│   └── config.json    # 运行时配置模板
└── config.json        # 本地开发配置（不进入镜像）
```

### 1.3 镜像构建与运行流程

```
docker compose up --build
  │
  ├── 1. 读取 docker/.dockerignore → 过滤构建上下文
  ├── 2. Dockerfile 构建阶段（build）
  │     ├── FROM node:24 → 设置工作目录 /build
  │     ├── COPY package*.json → npm ci（全量依赖）
  │     ├── COPY tsconfig.json src/ → npm run build（tsc 编译）
  │     └── 产出 dist/ 目录
  ├── 3. Dockerfile 运行阶段（runtime）
  │     ├── FROM node:24 → USER node
  │     ├── COPY --from=build dist/ → /data/dist/
  │     ├── COPY package*.json → npm ci --omit=dev（仅生产依赖）
  │     ├── COPY docker/config.json → /data/config.json
  │     ├── EXPOSE 11411
  │     └── CMD ["node", "dist/app.js"]
  ├── 4. docker compose 启动容器
  │     ├── 端口映射 11411:11411
  │     ├── volume 挂载 ./docker/config.json:/data/config.json
  │     └── 容器内 node 用户运行服务
  └── 5. 服务就绪，监听 0.0.0.0:11411
```

## 2. 多阶段构建设计

### 2.1 构建阶段（build）

**目的**：在完整 Node.js 环境中编译 TypeScript 源码，生成 JavaScript 产物。

```
FROM node:24 AS build
WORKDIR /build

# 层 1: 依赖安装（利用缓存，package.json 不变时跳过 npm ci）
COPY package.json package-lock.json ./
RUN npm ci

# 层 2: 源码编译（tsconfig.json 或 src/ 变更时重新编译）
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
```

**层缓存策略**：
- 第一层（`package*.json` + `npm ci`）：依赖文件不常变动，频繁命中缓存
- 第二层（`tsconfig.json` + `src/` + `tsc`）：源码变更后才重新编译

### 2.2 运行阶段（runtime）

**目的**：仅包含运行时所需的最小文件集，以非 root 用户运行。

```
FROM node:24 AS runtime
USER node
WORKDIR /data

# 层 1: 生产依赖（利用缓存）
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

# 层 2: 编译产物
COPY --chown=node:node --from=build /build/dist/ ./dist/

# 层 3: 配置模板
COPY --chown=node:node docker/config.json ./

EXPOSE 11411
CMD ["node", "dist/app.js"]
```

**关键决策**：
- `USER node` 在 `WORKDIR` 之前设置，后续所有 `COPY` 使用 `--chown=node:node` 保证文件归属
- `npm ci --omit=dev` 仅安装 `dependencies`，排除 `devDependencies`（typescript、ts-node、nodemon 等）
- `config.json` 放在运行阶段的最后一层——配置变更只需重建最后一层，不影响依赖缓存

### 2.3 构建产物流向

```
[项目源码 src/] ──COPY──▶ [构建容器 /build/src/] ──tsc──▶ [/build/dist/]
                                                                │
                                                    COPY --from=build
                                                                │
                                                                ▼
[node_modules/ (生产)] ◀──npm ci── [运行容器 /data/] ◀──COPY── [/data/dist/]
                                                     ◀──COPY── [docker/config.json]
```

## 3. 构建上下文优化

### 3.1 .dockerignore 规则

```
# 已编译产物（构建阶段会重新生成）
dist/

# 依赖目录（构建阶段通过 npm ci 安装）
node_modules/

# 版本控制
.git/
.gitignore

# 环境变量文件（敏感信息）
.env
.env.*

# 文档与规格文件
*.md
specs/

# Docker 自身文件（避免递归）
docker/

# 开发配置
nodemon.json

# 日志文件
*.log
npm-debug.log*

# 编辑器与系统文件
.DS_Store
.vscode/
.idea/
```

### 3.2 效果评估

| 指标 | 无 .dockerignore | 有 .dockerignore | 减少 |
|------|-----------------|-----------------|------|
| 构建上下文大小 | ~200 MB（含 node_modules） | ~2 MB（仅源码和配置） | ~99% |
| 上下文传输时间 | 5-10 秒 | < 1 秒 | ~90% |

`.dockerignore` 确保 Docker 构建上下文不包含 `node_modules`（~180 MB）、`.git` 目录及其他无关文件，大幅减少构建第一步的上下文传输时间。

## 4. 配置模板设计

### 4.1 config.json 模板

`docker/config.json` 内容：

```json
{}
```

**设计理由**：
- 空 JSON 对象作为最小可用配置，符合 Zod Schema 的默认值填充机制（`ConfigSchema` 中所有字段均有 `default()`）
- 用户通过 volume 挂载覆盖：`./docker/config.json:/data/config.json`
- 在 docker-compose.yml 中声明的 volume 绑定使修改配置后仅需 `docker compose restart` 即可生效，无需重建镜像

### 4.2 配置生效路径

```
宿主机                           容器内
./docker/config.json  ──volume──▶  /data/config.json
                                       │
                                       ▼
                              loadConfig() → Zod 校验 → RuntimeConfig
```

当 `config.json` 不存在或为空时，配置模块的 Zod Schema 默认值（`listening_port: 11411`，`backends: []` 等）将接管，服务仍可启动但无后端路由。

## 5. 容器编排设计

### 5.1 docker-compose.yml 规格

```yaml
version: "3.8"

services:
  llm-router:
    image: fellow99/llm-router
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "11411:11411"
    volumes:
      - ./config.json:/data/config.json
    restart: unless-stopped
```

**字段说明**：

| 字段 | 值 | 说明 |
|------|---|------|
| `image` | `fellow99/llm-router` | 本地镜像标签，符合 Docker Hub 命名规范 |
| `build.context` | `..`（项目根目录） | docker-compose.yml 在 `docker/` 子目录，需回溯一级 |
| `build.dockerfile` | `docker/Dockerfile` | 指定 Dockerfile 路径 |
| `ports` | `11411:11411` | 宿主机端口 : 容器端口 |
| `volumes` | `./config.json:/data/config.json` | 相对于 compose 文件路径（即 `docker/config.json`） |
| `restart` | `unless-stopped` | 容器异常退出自动重启，手动停止不重启 |

### 5.2 环境变量注入（扩展点）

部署者可通过以下方式注入环境变量（不纳入本次范围，作为部署文档指导）：

```yaml
services:
  llm-router:
    # 方式一：直接声明
    environment:
      - LLMROUTER_API_KEY=sk-xxxxx
      - OPENAI_API_KEY=sk-xxxxx
    # 方式二：引用 .env 文件
    env_file:
      - .env
```

## 6. 安全与镜像最小化

### 6.1 安全措施清单

| 措施 | 实现方式 | 对应需求 |
|------|---------|---------|
| 非 root 运行 | `USER node`（node:24 镜像内置 node 用户，UID 1000） | FR-DOCK-002, FR-DOCK-006 |
| 排除 devDependencies | `npm ci --omit=dev` | FR-DOCK-002, FR-DOCK-006 |
| 排除 TypeScript 源码 | 仅复制 `dist/`，不复制 `src/` | FR-DOCK-006 |
| 排除敏感文件 | `.dockerignore` 排除 `.env`, `.git/` | FR-DOCK-003, FR-DOCK-006 |
| 排除构建工具 | 运行阶段不含 tsc、npm 全局包 | FR-DOCK-006 |
| 最小攻击面 | 仅暴露 11411 端口 | FR-DOCK-002 |

### 6.2 镜像体积预估

| 层 | 内容 | 预估大小 |
|----|------|---------|
| node:24 基础镜像 | Alpine / Slim 变体 | ~120 MB |
| node_modules（生产） | express, zod, winston 等 8 个包 | ~30 MB |
| dist/ | tsc 编译产物（16 个 .ts → .js） | ~2 MB |
| config.json | 空 JSON | < 1 KB |
| **合计** | | **~152 MB** |

目标：< 300 MB（成功标准 SC-003），预估 152 MB，留有充足余量。

> **注**：若使用 `node:24-alpine` 基础镜像可进一步缩减至 ~70 MB，当前方案默认使用 `node:24`（基于 Debian）以保证 glibc 兼容性。

## 7. 错误处理

| 错误场景 | 处理方式 | 用户可见行为 |
|---------|---------|------------|
| `npm ci` 失败（网络/依赖问题） | Docker 构建中断，返回非零退出码 | `docker compose up --build` 输出 npm 错误日志 |
| `tsc` 编译失败 | Docker 构建中断 | 输出 TypeScript 编译错误，指明文件和行号 |
| 运行时 `config.json` 不存在 | 配置模块 Zod 默认值接管 | 服务启动但无后端路由，日志输出警告 |
| 端口 11411 被占用 | Docker 端口绑定失败 | `docker compose up` 报端口冲突错误 |
| Volume 挂载的 config.json 格式错误 | Zod 校验失败，进程退出 | 容器状态 `Exited(1)`，`docker compose logs` 查看校验错误 |
| 基础镜像拉取失败 | Docker 构建中断 | 输出 registry 连接错误信息 |

## 8. 构建与验证流程

### 8.1 本地构建验证

```bash
# 1. 清理旧产物
rm -rf dist/

# 2. 一键构建并启动
docker compose -f docker/docker-compose.yml up --build

# 3. 验证服务可用
curl http://localhost:11411/health

# 4. 验证镜像大小
docker images fellow99/llm-router --format "{{.Size}}"

# 5. 验证非 root 运行
docker compose -f docker/docker-compose.yml exec llm-router whoami
# 预期输出: node

# 6. 停止并清理
docker compose -f docker/docker-compose.yml down
```

### 8.2 构建缓存验证

```bash
# 第一次构建：全部层构建
docker compose -f docker/docker-compose.yml build

# 第二次构建（无变更）：全部命中缓存
docker compose -f docker/docker-compose.yml build
# 预期: 所有层输出 "CACHED"

# 修改 src/app.ts 后重建：仅 COPY src/ 和 RUN npm run build 重建
docker compose -f docker/docker-compose.yml build
# 预期: package.json 层 CACHED，编译层重新执行
```

### 8.3 成功标准校验矩阵

| 编号 | 标准 | 验证方法 |
|------|------|---------|
| SC-001 | `docker compose up --build` 成功启动 | 容器状态 `Up`，端口 11411 可访问 |
| SC-002 | `POST /chat/completions` 正常路由 | 配置后端后发送请求，检查响应 |
| SC-003 | 镜像大小 < 300 MB | `docker images` 检查 SIZE 字段 |
| SC-004 | 无安全告警 | 非 root 运行，devDependencies 未安装 |
| SC-005 | 层缓存策略正确 | 重复构建时未修改层使用缓存 |
