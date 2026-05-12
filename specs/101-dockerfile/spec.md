# 创建镜像环境 (101) 功能规格

> 模块路径: `docker/`
> 生成时间: 2026-05-12
> 分支: `specs/101-dockerfile`

## 概述

为 llm-router 服务创建 Docker 镜像构建环境，使服务可通过 Docker 容器化部署。包含多阶段构建的 Dockerfile（编译阶段 + 运行阶段）、容器编排配置（docker-compose.yml）、以及相关的构建辅助文件（.dockerignore、配置模板等）。镜像基于官方 node:24 镜像构建，以非 root 用户运行，容器监听端口 11411。

## 功能需求

### FR-DOCK-001: Docker 目录结构

- 在项目根目录创建 `docker/` 目录，集中管理所有镜像构建相关文件
- 目录内包含：`Dockerfile`、`docker-compose.yml`、`.dockerignore`、`config.json`（模板）

### FR-DOCK-002: 多阶段 Dockerfile

- 采用多阶段构建：第一阶段（build）编译 TypeScript 源码，第二阶段（runtime）仅包含运行时依赖和生产产物
- **构建阶段（build）**：
  - 基础镜像：`node:24`
  - 设置工作目录 `/build`
  - 复制 `package.json` 和 `package-lock.json`
  - 运行 `npm ci` 安装所有依赖（含 devDependencies）
  - 复制 `tsconfig.json` 和 `src/` 目录
  - 运行 `npm run build`（即 `tsc`）编译至 `dist/`
- **运行阶段（runtime）**：
  - 基础镜像：`node:24`
  - 使用 `USER node` 切换至非 root 用户
  - 设置工作目录 `/data`
  - 从构建阶段复制 `dist/` 至 `/data/dist/`
  - 复制 `package.json` 和 `package-lock.json`，运行 `npm ci --omit=dev` 仅安装生产依赖
  - 复制 `config.json` 至 `/data/config.json`
  - 通过 `EXPOSE 11411` 声明监听端口
  - 通过 `CMD ["node", "dist/app.js"]` 启动服务

### FR-DOCK-003: .dockerignore 文件

- 创建 `.dockerignore` 文件，排除不应进入构建上下文的文件
- 排除内容至少包括：`node_modules/`、`dist/`、`.git/`、`*.md`、`.env`、`specs/`、`docker/`、`nodemon.json`、`*.log`

### FR-DOCK-004: 配置模板 config.json

- 在 `docker/` 目录中创建 `config.json` 模板文件
- 内容为 `{}`（空 JSON 对象），作为用户自定义配置的占位符
- 该文件将在镜像构建时复制到容器内 `/data/config.json`
- 运行时可通过 volume 挂载覆盖此文件

### FR-DOCK-005: docker-compose.yml 编排

- 服务名称为 `llm-router`
- 镜像名称为 `fellow99/llm-router`（构建后本地标签）
- 端口映射：`11411:11411`（宿主机 : 容器）
- Volume 映射：`./docker/config.json:/data/config.json`（便于运行时修改配置）
- 支持 `docker compose up --build` 一键构建并启动

### FR-DOCK-006: 镜像安全与最小化

- 第二阶段运行镜像不包含 devDependencies、TypeScript 源码、构建工具
- 以非 root 用户（node）运行，降低安全风险
- 仅安装生产依赖（`npm ci --omit=dev`）
- 使用 `.dockerignore` 避免将敏感文件（如 `.env`）或无关文件（如 `specs/`）复制进镜像

## 关键文件

### `docker/Dockerfile`

多阶段构建文件，定义构建和运行两个阶段，控制镜像层缓存策略（先复制依赖文件安装依赖，再复制源码编译）。

### `docker/docker-compose.yml`

容器编排文件，定义服务名称、镜像标签、端口映射、volume 挂载，支持 `docker compose up --build` 命令一键构建和启动。

### `docker/.dockerignore`

构建忽略文件，排除 `node_modules`、`dist`、`.git`、文档文件、开发配置等，减小构建上下文体积。

### `docker/config.json`

配置模板文件，初始内容为 `{}`，通过 volume 挂载到容器内的 `/data/config.json`，支持用户自定义多后端路由配置。

## 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| 构建阶段 `npm ci` 失败 | Docker 构建中断，输出 npm 错误日志 |
| 构建阶段 `tsc` 编译失败 | Docker 构建中断，输出 TypeScript 编译错误 |
| 运行时 `config.json` 不存在 | 服务使用内置默认配置继续运行（配置模块现有行为） |
| 运行时端口被占用 | Docker 容器启动失败，docker compose 输出端口冲突错误 |
| Volume 挂载的 config.json 格式错误 | 服务进程退出，由配置模块 Zod 校验报错 |

## 假设与依赖

- 运行时依赖的 `.env` 环境变量通过 `docker-compose.yml` 的 `environment` 或 `env_file` 字段注入（由部署者配置，不纳入本次 Dockerfile 范围）
- 镜像基于 `node:24` 官方镜像，依赖 Docker Hub 可用性
- 构建环境具备 Docker BuildKit（`DOCKER_BUILDKIT=1`）
- 生产环境反向代理（如 Nginx）负责 HTTPS 终止和额外端口转发，本容器仅暴露 HTTP 11411

## 成功标准

1. 执行 `docker compose up --build` 后，容器成功启动且服务在端口 11411 可访问
2. 向容器发送 `POST /chat/completions` 请求可正常路由至配置的后端服务
3. 最终镜像大小小于 300 MB（不含用户配置数据）
4. 构建过程中无安全告警（无 root 用户运行，无不必要的包）
5. Dockerfile 每个阶段的层缓存策略正确，重复构建时未修改层使用缓存
