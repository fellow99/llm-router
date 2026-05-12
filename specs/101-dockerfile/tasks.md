# 101 Docker 镜像环境 — 开发任务

> 功能: 创建 Docker 镜像构建与容器编排环境
> 源码路径: `docker/`
> 参考: spec.md (FR-DOCK-001 ~ FR-DOCK-006), plan.md (技术方案)

## Phase 1: Docker 目录初始化

- [ ] T101-01 创建 `docker/` 目录结构，作为所有 Docker 镜像构建相关文件的集中管理目录
  - 输入: spec.md FR-DOCK-001, plan.md §1.1
  - 输出: 项目根目录下新增 `docker/` 目录
  - 验收: `ls docker/` 目录存在

## Phase 2: 构建上下文与配置模板

- [ ] [P] T101-02 创建 `.dockerignore` 文件 `docker/.dockerignore`
  - 输入: spec.md FR-DOCK-003, plan.md §3.1
  - 输出: 排除规则至少包含: `dist/`, `node_modules/`, `.git/`, `.env`, `.env.*`, `specs/`, `docker/`, `*.md`, `nodemon.json`, `*.log`, `npm-debug.log*`, `.DS_Store`, `.vscode/`, `.idea/`
  - 验收: 构建上下文大小 < 5 MB（不含 node_modules 和 .git）；排除的目录/文件不会出现在镜像构建过程中
  - 文件: `docker/.dockerignore`

- [ ] [P] T101-03 创建配置模板 `docker/config.json`
  - 输入: spec.md FR-DOCK-004, plan.md §4.1
  - 输出: 内容为 `{}`（空 JSON 对象），作为用户自定义配置占位符
  - 验收: `cat docker/config.json` 输出 `{}`；文件为合法 JSON 格式
  - 文件: `docker/config.json`

## Phase 3: 多阶段 Dockerfile

- [ ] T101-04 实现多阶段 Dockerfile `docker/Dockerfile`
  - 输入: spec.md FR-DOCK-002, FR-DOCK-006, plan.md §2
  - **构建阶段 (build)**:
    - 基础镜像 `node:24 AS build`
    - 工作目录 `/build`
    - `COPY package.json package-lock.json ./` → `RUN npm ci`（全量依赖，利用层缓存）
    - `COPY tsconfig.json ./` + `COPY src/ ./src/` → `RUN npm run build`（tsc 编译至 dist/）
  - **运行阶段 (runtime)**:
    - 基础镜像 `node:24 AS runtime`
    - `USER node`（非 root，UID 1000）
    - 工作目录 `/data`
    - `COPY --chown=node:node package.json package-lock.json ./` → `RUN npm ci --omit=dev`（仅生产依赖）
    - `COPY --chown=node:node --from=build /build/dist/ ./dist/`
    - `COPY --chown=node:node docker/config.json ./`
    - `EXPOSE 11411`
    - `CMD ["node", "dist/app.js"]`
  - 验证点:
    - 构建阶段 npm ci 和 tsc 可成功执行
    - 运行阶段以 node 用户（非 root）启动
    - 运行阶段不含 devDependencies（无 typescript、ts-node、nodemon 等）
    - 运行阶段不含 TypeScript 源码（src/）
    - 层缓存策略正确：重复构建时未修改层显示 CACHED
  - 文件: `docker/Dockerfile`

## Phase 4: 容器编排

- [ ] T101-05 创建 docker-compose.yml `docker/docker-compose.yml`
  - 输入: spec.md FR-DOCK-005, plan.md §5.1
  - 输出: YAML 编排文件，包含:
    - `version: "3.8"`
    - service `llm-router`，image `fellow99/llm-router`
    - `build.context: ..`（项目根目录），`build.dockerfile: docker/Dockerfile`
    - `ports: "11411:11411"`
    - `volumes: ./config.json:/data/config.json`（相对于 compose 文件路径即 `docker/config.json`）
    - `restart: unless-stopped`
  - 验证点:
    - `docker compose -f docker/docker-compose.yml config` 无语法错误
    - volume 路径 `./config.json` 正确解析为 `docker/config.json`
    - 宿主机端口 11411 映射至容器端口 11411
  - 文件: `docker/docker-compose.yml`

## Phase 5: 集成验证

- [ ] T101-06 端到端构建与运行验证
  - 输入: spec.md 成功标准 SC-001 ~ SC-005, plan.md §8
  - 验证清单:
    1. **构建成功**: `docker compose -f docker/docker-compose.yml up --build` 退出码为 0，构建过程无错误
    2. **服务可访问**: `curl http://localhost:11411/health` 返回 JSON 响应（含 name/version/description）
    3. **镜像大小**: `docker images fellow99/llm-router --format "{{.Size}}"` < 300 MB
    4. **非 root 运行**: `docker compose -f docker/docker-compose.yml exec llm-router whoami` 输出 `node`
    5. **层缓存**: 未修改源码时第二次 `docker compose build` 全部层显示 `CACHED`
    6. **配置挂载**: 修改 `docker/config.json` 后 `docker compose restart` 即可生效，无需重建镜像
    7. **端口正确**: 容器内服务监听 0.0.0.0:11411（通过 `docker compose exec llm-router ss -tlnp` 或端口映射验证）
  - 验证方法: 依次执行 plan.md §8.1 ~ §8.3 中的命令，对照成功标准校验矩阵逐项确认
  - 清理: 验证完成后执行 `docker compose -f docker/docker-compose.yml down` 停止并移除容器
