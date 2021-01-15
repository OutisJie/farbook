# Docker发布文档

重要概念：
* 服务 (**service**)：一个应用的容器，实际上可以包括若干运行相同镜像的容器实例。
* 项目 (**project**)：由一组关联的应用容器组成的一个完整业务单元，在 `docker-compose.yml` 文件中定义。

## Docker-Compose 简介

**Docker**通过 `Dockerfile` 模板文件，可以很方便的为一个服务定义一个容器，让服务可以在容器中运行。但一个完整的Web项目，不仅仅是一个前端的Web服务，还需要后端提供的服务。无论是微前端还是后端的微服务，每一个项目都需要很多不同的服务相互合作才能搭建成功。

当一个项目关联的服务特别多的时候，管理起来就特别麻烦。假如你要重启一个项目，你就得把这个项目涉及到的所有服务都重启一遍。

**docker-compose** （定义和运行多个Docker容器的应用）。它允许用户通过一个`docker-compose.yaml`文件将一组互相关联的**应用容器**定义为一个**项目**。**docker-compose** 的默认管理对象是**项目**，通过各种子命令来便携的管理项目中一组容器的生命周期。

## Docker-Compose 注意事项

**YiGo** 发布原则:

* 全部以镜像形式发包
  * 本地需安装好Docker-Compose，所有的项目都需要在本地先build
  * 将本地打包生成的容器镜像推送到服务器。
* 以脚本的形式执行发布动作
  * 每个项目的repo下都有 `build.sh` 或者 `publish.sh` 文件 
* 单线发布，只能在master分支上发布
  * 线性迭代，最新发布的版本必须包含前一个版本的内容
* 前后端统一管理
  * 每个项目所包含的所有应用都在同一个 **Git Repository** 下
  * 每个项目至少包含一个Web应用和一个后端应用
  * 每次发包时，需要对项目下所有应用统一打包
* 打包时，需指定上下文
  * `docker build -t [service name] . `，`.` 指定上下文为当前目录，docker会把上下文的所有内容打包发送给Docker API。
  * `.dockerignore` 文件，告诉docker哪些东西是不需要的，特别是`node_modules`
  

**Dockerfile**原则：

* Dockerfile应该放在代码仓库的根目录中，比如`Webapp/Dockerfile`.
* Dockerfile的命令应该越少越好，每执行一条命令，就会构建一层镜像，会造成很大的浪费

## Docker-Compose 发布

各个**应用**以进程的形式在**容器**中运行，而**容器**则创建在**镜像**上，各个容器相互独立，各个应用相互隔离。这种特性使得容器封装的应用更加安全。**容器**是动态的，需要在部署时创建，而**镜像**是静态的，所以镜像是可以复用的，而**仓库**的存在，让用户可以共享自己的**镜像**。

### 前置条件

#### `Dockerfile`

`Dockerfile` 的作用是定制**镜像**。每个应用都应该有一个`Dockerfile`文件，告诉 **Docker** 为当前应用创建一个**定制的镜像**，然后在此镜像上，再构建一个容器让应用运行。

对于前端web应用而言，基本上都是基于Nginx镜像的：

```Dockerfile
FROM nginx 
# FROM指定一个基础镜像，可以是ubuntu、nginx这种公共镜像，也可以是私有镜像
RUN echo '<h1>Hello, Docker!</h1>' > /usr/share/nginx/html/index.html 
# Run命令，相当于一个Shell脚本
```

YiGo镜像：
```Dockerfile
FROM it-artifactory.yitu-inc.com/zagu-docker/gitlab-ci-tools/frontend-nginx:latest
# FROM也可以指定基础镜像的Tag版本，格式为 [镜像名]:[版本号] 
# yigo的web基础镜像都是这个
EXPOSE 80
COPY build /usr/share/nginx/html
# 将当前上下文目录的build文件复制到目标镜像的/usr/share/nginx/html
COPY nginx.conf /etc/nginx
# 将当前上下文目录中的nginx.conf复制到目标镜像的/etc/nginx
```

更详细的`Dockerfile`指令请看[Dockerfile指令详解](https://yeasy.gitbook.io/docker_practice/image/dockerfile)


#### `docker-compose.yaml`

```yaml
version: "3"
services: # 项目下的所有应用
  mongodb: # 数据库
    image: "mongo:latest" # 本地打包后推送给服务器的镜像
    networks: # 容器连接的网络
      - network_pnc
    volumes: # 数据卷路径设置，应用容器可以在里面写数据，数据不会随着容器的关闭而消失
      - db-data:/data/db

  backend: # 后端
    image: "it-artifactory.yitu-inc.com/docker-research/humidifier/yigoauto/purifier-server:{VERSION}" # 这里名称和VERSION需要和你push到服务器的镜像名称一致
    environment: # 环境变量
      MONGO_IP: mongodb
      MONGO_PORT: 27017 
    depends_on: # 容器的启动顺序
      - mongodb
    volumes:
      # 动态修改
      - /mnt/WXRG0135/rbzhou/00_Data/00_MapAnno/data:/mnt/WXRG0135/rbzhou/00_Data/00_MapAnno/data:ro
    networks:
      - network_pnc

  frontend: # 前端     
    image: "it-artifactory.yitu-inc.com/docker-research/humidifier/yigoauto/purifier-website:{VERISON}" # 这里名称和VERSION需要和你push到服务器的镜像名称一致
    ports: # 前端应用的端口
      - "2169:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
    networks:
      - network_pnc

networks: # 容器连接的网络
  network_pnc:

volumes:
  db-data:

```

更详细的内容请看[Compose 模板文件](https://yeasy.gitbook.io/docker_practice/compose/compose_file)

#### `requirements.txt`


### 打包

对于一个前端应用而言，其打包流程如下：

```bash
# 打包web应用
cd webapp 
yarn build

# 为service构建镜像, `.` 指定上下文目录
# build命令会默认读取当前目录下的Dockerfile
# 也可以用`-f ./../myDockerfile` 指定，但是不推荐这么做
docker build -t [service name] .

# 为构建好的镜像打上Tag，每个Tag对于一个版本
docker image tag [service name] [service name]:${VERSION}
```

**YiGo项目**打包：

YiGo现有几个项目的Repo下，都会提供一份`publish.sh`或`build.sh`，直接cd到工作目录，运行即可。win 10需要在git bash中运行。
```bash
./publish.sh VERSION
# 或者./build.sh
# VERSION是你要发布的版本号
```

### 部署

1. 推送给服务器

```bash
# 将本地构建好的镜像推送到服务器
docker push [service name]:${VERSION}  
docker push [service name]:latest 

```

2. 在服务器上启动容器

```bash
# 用户名密码登录服务器
ssh username@serverIp

# 连接到tmux
tmux attach -t Deploy

```

3. docker 启动容器
```bash
# run 为镜像[service name]新建并启动一个容器
# -d 表示容器运行在后台，其输出不会打印在当前服务器上
# 启动后会返回一个唯一的容器 id
docker run -d [service name]

# docker container 可以对镜像下的容器进行管理
# 通过 docker container ls 命令来查看所有容器信息
# 通过 docker container logs [container id] 查看日志
# start 启动一个停止状态下的容器
docker container start [container id] 

# exec 命令可以进入到容器内部进行操作
docker exec -it [container id]  bash
```

4. docker-compose 启动

**YiGo项目** 发布时，会同时对多个应用构建多个镜像，并推送到服务器，这时候就不能用docker一个一个的来启动了。

```bash
# cd到需要启动的项目目录下，该目录下应该包含一个docker-compose.yaml的文件
cd purifier 

# 修改配置，需要指定你在打包时构建的所有镜像，具体配置可以看下面Docker-compose.yml那一小节
vi docker-compose.yml

# up 命令将尝试自动完成包括构建镜像，（重新）创建服务，启动服务，并关联服务相关容器的一系列操作。
# -p 指定需要启动的项目名称，默认是当前目录名
# -d 后台启动并运行所有的容器
docker-compose -p [project-name] up -d

```


## Docker-Compose 常用命令

```bash
docker-compose [-f=<arg>...] [options] [COMMAND] [ARGS...]
```

默认情况下，compose 命令对象将是项目，这意味着项目中所有的服务都会受到命令影响。

### options:

* `-f, --file FILE` 指定使用的 Compose 模板文件，默认为 docker-compose.yml，可以多次指定。
* `-p, --project-name NAME` 指定项目名称，默认将使用所在目录名称作为项目名。
* `--verbose` 输出更多调试信息。
* `-v, --version` 打印版本并退出。

### up

```bash
compose up [options] [services...]
```

可以说，大部分时候都可以直接通过该命令来启动一个项目。

推荐生产环境下使用 `docker-compose up -d`，将会在后台启动并运行所有的容器。

up命令会自动完成包括构建镜像，（重新）创建服务，启动服务，并关联服务相关容器的一系列操作。如果服务容器已经存在，`docker-compose up` 将会尝试停止容器，然后重新创建。当通过 `Ctrl-C` 停止命令时，所有容器将会停止。

如果用户只想重新部署某个服务，可以使用这个命令来重新创建服务并后台停止旧服务：

```bash
docker-compose up --no-deps -d <SERVICE_NAME>
```

* `-d` 在后台运行服务容器。
* `--no-color` 不使用颜色来区分不同的服务的控制台输出。
* `--no-deps` 不启动服务所链接的容器。
* `--force-recreate` 强制重新创建容器，不能与 --no-recreate 同时使用。
* `--no-recreate` 如果容器已经存在了，则不重新创建，不能与 `--force-recreate` 同时使用。
* `--no-build` 不自动构建缺失的服务镜像。
* `-t, --timeout TIMEOUT` 停止容器时候的超时（默认为 10 秒）。

### build

```bash
docker-compose build [options] [SERVICE...]
```

构建（重新构建）项目中的服务容器。可以随时在项目目录下运行 docker-compose build 来重新构建服务。

选项包括：
* `--force-rm` 删除构建过程中的临时容器。
* `--no-cache` 构建镜像过程中不使用 cache（这将加长构建过程）。
* `--pull` 始终尝试通过 `pull` 来获取更新版本的镜像。


### run

```bash
docker-compose run [options] [-p PORT...] [-e KEY=VAL...] SERVICE [COMMAND] [ARGS...]
```

在指定SERVICE服务上执行一个命令。

例如：
```bash
$ docker-compose run ubuntu ping docker.com
```
将会启动一个 ubuntu 服务容器，并执行 `ping docker.com` 命令。
默认情况下的行为跟`up`命令一致，只不过它还会多余的去执行Command命令。


### images

列出 Compose 文件中包含的镜像。

### exec

进入指定的容器。

### start
```docker-compose start [SERVICE...]```
启动已经存在的服务容器。

### stop
```docker-compose stop [options] [SERVICE...]```
停止已经处于运行状态的容器，但不删除它。通过 `docker-compose start` 可以再次启动这些容器。

更多细节请看[命令说明](https://yeasy.gitbook.io/docker_practice/compose/commands)
