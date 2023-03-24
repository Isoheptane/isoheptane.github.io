+++
title = "配置 VLESS+TCP+XTLS + Nginx 流量伪装 + VMess 回落"
tags = ["代理", "V2Ray"]
date = "2022-01-21"
update = "2023-03-24"
enableGitalk = true
+++

## 前言
放假前几天，原来的域名就要过期了。不过咱的代理服务器还是需要一个域名的，所以这几天买了 `cascade.moe` 这个域名，准备重建代理。  

我原本是打算继续用 `wulabing` 的 [V2Ray 基于 Nginx 的 vmess+ws+tls 一键安装脚本](https://github.com/wulabing/V2Ray_ws-tls_bash_onekey)，不过后来又想自己折腾。于是选择了自己在服务器上，从零开始配置 VLESS 代理服务器。配置代理这次使用了 Xray 而不是 V2Ray，想试试被称为黑科技的 XTLS。

这次就只写配置阶段的内容吧。

## 准备工作
- 需要有一台国外的 VPS，这里安装的是 Ubuntu 20.04.3 LTS。
- 配置代理需要准备一个域名，基本上只要有这个域名就行。  
- XTLS 协议需要 SSL 证书，因此这里还需要预先申请好这个域名的 SSL 证书。

## 配置 VLESS+TCP+XTLS 代理
### 安装 Xray
首先，需要在服务器上安装 Xray：

```shell
$ bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

安装完成后，Xray 可以被作为服务启动，默认配置文件的路径为 `/usr/local/etc/xray/config.json`。

### 修改配置文件
在这里需要修改这个配置文件 `config.json`，可以使用 `vim`、`nano` 等编辑器直接在服务器上编辑，也可以在本地编辑好后使用 SFTP 上传至服务器。配置文件中填入以下内容：  

```json
{
    "log": {
        "loglevel": "warning"
    },
    // 所有入站代理，用于接收发来的数据
    "inbounds": [
        {
            "tag": "inbound-proxy-vless",
            "listen": "0.0.0.0", // 监听的 IP 地址，设置为 0.0.0.0 时代表监听所有入站的连接
            "port": 443, // VLESS 代理端口
            "protocol": "vless",
            "settings": {
                // 用户设置，可用于流量统计和用户本地策略设置
                // 由于在这里并不需要这些东西，因此只创建一个用户
                "clients": [
                    {
                        "id": "01234567-89ab-cdef-0123-456789abcdef", // 这里是用户ID，用自己生成的 UUID 替换掉
                        "flow": "xtls-rprx-direct", // 流控，选 xtls-rprx-direct 性能会更好一些
                        "level": 0
                    }
                ],
                "decryption": "none", // 这里目前只能设置为 none
                "fallbacks": [] // 回落设置，在之后会用到
            },
            "streamSettings": { // 传输方式设置
                "network": "tcp", // 指定传输协议为 TCP
                "security": "xtls", // 指定传输层安全为 XTLS
                "xtlsSettings": {
                    "serverName": "name.yourdomain", // 这里替换为域名
                    "allowInsecure": false,
                    "alpn": [], // 这里会用于流量伪装
                    "minVersion": "1.2",
                    "certificates": [
                        {
                            "certificateFile": "certificate.crt", // 这里替换为证书的路径
                            "keyFile": "key.key" // 这里替换为密钥的路径
                        }
                    ]
                }
            }
        }
    ],
    // 所有出站代理，用于发送数据
    "outbounds": [
        {
            "tag": "outbound-proxy-freedom",
            "protocol": "freedom" // 这里只需要从代理服务器直接访问网络，因此设置为 freedom
        }
    ]
}
```

{{< notice warning >}}
XTLS Direct 流控被指出存在[被主动探测和攻击的风险](https://github.com/e1732a364fed/xtls-/blob/main/README.md#%E5%85%B3%E4%BA%8Exray%E7%9A%84%E5%AE%89%E5%85%A8%E9%97%AE%E9%A2%98)，因此不再建议使用 `xtls-rprx-direct` 流控。如果要使用 XTLS，请选择 **XTLS Vision** 流控。 
{{< /notice >}}

{{< notice note >}}
JSON 不支持注释，因此需要将配置文件中所有双斜杠后的内容删去。
{{< /notice >}}

修改好上述配置文件后，可以通过以下命令检测配置文件是否正常：

```shell
$ xray -test -config /usr/local/etc/xray/config.json
```

若最后一行输出 `Configuration OK.`，则配置文件正常。接下来可以启动 Xray 服务，使之开机自启动。

```shell
$ systemctl enable xray
$ systemctl start xray
```

## 配置 Nginx 流量伪装
Nginx 反代流量伪装是一种常见的伪装方式，其基本原理为：
- Xray 监听某一端口（假设为 11451），并且仅允许本地连接（即监听 `127.0.0.1`）。
- Nginx 监听 443 端口，并正常运行一个网站。
- 当访问到某一特定路径时（如 `/114514/1919810/`）时，将流量转发至 11451 端口，进行代理。  

Nginx 反代流量伪装通常是使用 WebSocket 的，因为 WebSocket 在握手阶段使用 HTTP。  

但是在这里的配置将不会使用 Nginx 反代流量伪装，而是使用 VLESS 回落至 Nginx 进行伪装。

### VLESS 回落 Nginx
VLESS 可以检测非 VLESS 协议，将非 VLESS 协议流量进行分流。其基本原理为：
- Xray 监听 443 端口，当 VLESS 协议验证通过时进入 Xray 代理。
- 当 VLESS 协议验证不通过时，通过指定的回落规则，将流量转发至其它服务器或套接字。
  
因此可以将流量转发至本地运行的 Nginx 来将代理服务器伪装成一个正常的网站。  

一个回落规则的配置如下：
```json
{
    "name": "", // 尝试匹配 TLS SNI 主机名
    // 可以理解为匹配访问服务器时，使用的主机名

    "alpn": "", // 尝试匹配 TLS ALPN 协商结果
    // 可以理解为匹配访问服务器时协商的应用层协议

    "path": "", // 尝试匹配 HTTP PATH 路径
    // 例如 "https://cascade.moe/path/" 中的 "/path/" 这一部分

    "dest": "", // 解密后 TCP 流量的去向
    // 可以是其它服务器、本地端口号或 Unix 域套接字

    "xver": ""  // 是否发送 Proxy Protocol 传递真实来源 IP 和端口
    // 0: 不发送  1: v1 版本，人类可读  2: v2 版本，二进制
}
```

现在需要配置好回落至 Nginx 的回落规则。由于 Nginx 无法在一个端口上同时监听 HTTP/1.1 和 h2c，因此需要设置两个回落规则。假设 HTTP/1.1 监听端口为 17301，HTTP/2 监听端口为 17302，设置回落规则如下：

```json
{
    "alpn": "h2", // 设置匹配应用层协议为 HTTP/2
    "dest": 17302, // HTTP/2 监听端口
    "xver": 1
}
```
```json
{
    "dest": 17301, // HTTP/1.1 监听端口
    "xver": 1
}
```

当流量为非 VLESS 协议时，如果协议协商为 HTTP/2，则会将流量转发至本地的 17302 端口，否则转发到本地的 17301 端口。主动探测无法通过 VLESS 协议验证，因此会被转发至 Nginx。

除此之外，还需要在传输方式 (`streamSettings`) 设置中添加握手时可选的 ALPN 列表。需要注意顺序，`h2` 在前，`http/1.1` 在后。

```json
{
    "streamSettings": {
        "xtlsSettings": {
            "alpn": ["h2", "http/1.1"]
            // ...
```

{{< notice note >}}
修改配置文件之后别忘了用 `systemctl restart xray` 重启 Xray！
{{< /notice >}}

### 配置 Nginx 
这里需要先安装 Nginx：

```shell
$ sudo apt install nginx
```

安装完成后，Nginx 同样可以作为服务被启动，默认的配置文件路径为 `/etc/nginx/nginx.conf`，这里将基于这个默认的配置文件进行修改。

如果使用 Proxy Protocol，需要设置 Nginx 配置文件中的 `set_real_ip_from` 属性。在这里打开配置文件，然后加上：

```nginx
http {
    set_real_ip_from 127.0.0.1; # 这是需要加的行
    # ...
```

然后再设置一个服务器，监听 17301 和 17302 端口，可以设置为监听 `127.0.0.1` 地址。其中两个端口都需要监听 Proxy Protocol（如果前面回落的 `xver` 中设置为了非零值）。将下面的服务器配置粘贴到 `http {...} ` 当中：

```nginx
server
{
    listen 127.0.0.1:17301 proxy_protocol;
    listen 127.0.0.1:17302 proxy_protocol http2;

    server_name name.yourdomain; # 替换为域名
    root /opt/wwwroot/; # 替换为网站根目录，请确保 Nginx 使用的用户有读权限
    index index.html; # 首页的名字
    error_page 404 index.html; # 404 页面
}
```

此外，这里还建议设置一个服务器，用于从 80 端口跳转到 443 端口：

```nginx
server
{
    listen 0.0.0.0:80;
    server_name name.yourdomain; # 替换为域名
    return 301 https://name.yourdomain$request_uri; # 返回 301 并跳转到 HTTPS 默认使用的 443 端口
}
```

最后需要上传一个静态页面到配置文件中指定的网站根目录中，这个静态页面基本上用什么都行，可以去网上找一个或者自己写一个 ~~（也可以像我一样直接写个跳转）~~ 。到这里，Nginx 流量伪装的配置就基本完成了。此时用浏览器访问代理服务器，应该能正常显示刚才上传的静态页面。

同样别忘了修改配置文件后重启 Nginx 服务哦。

## 配置 VMess 回落
有些时候可能还需要兼容 VMess 协议，因此也可以通过回落，将访问 443 端口的 VMess 流量转发至本地的 VMess 入站代理。此时再向 `inbounds` 中添加一个 VMess 入站代理。这里以 VMess+WebSocket 为例：

```json
{
    "tag": "inbound-proxy-vmess",
    "listen": "127.0.0.1",
    "port": 17300,
    "protocol": "vmess", // 设置入站代理协议为 VMess
    "settings": {
        "clients": [
            {
                "id": "01234567-89ab-cdef-0123-456789abcdef", // 同样将此处替换为自己生成的 UUID
                "alterId": 0 // AlterID 需要设置为 0
            }
        ]
    },
    "streamSettings": {
        "network": "ws", // 使用 WebSocket 作为传输协议
        // 由于入站过程已经使用了 XTLS，在此处不需要安全层协议
        "wsSettings": {
            "acceptProxyProtocol": true, // 表示监听 Proxy Protocol
            "path": "/fallbacks/vmessws" // 访问 VMess 时的伪装路径
        }
    }
}
```

由于在建立与服务器的连接的过程中，已经创建了 XTLS 安全连接，因此入站后本地回落的 VMess 入站代理不需要再使用传输层安全。

同样，这里还需要再添加一个回落规则。由于这里是使用 `/fallbacks/vmessws` 这个路径访问 VMess 服务，因此还需要加上回落路径匹配。添加如下的回落规则：

```json
{
    "path": "/fallbacks/vmessws",
    "dest": 17300,
    "xver": 1
}
```

此时，当访问 `/fallbacks/vmessws` 这个路径时，VLESS 回落将会把流量转发至本地的 VMess 入站代理。这样就可以在同一个端口上兼容 VMess 协议了。至此，VMess 回落的配置就基本完成了。你也可以用类似的方法配置 VMess 使用其它协议的回落。  

需要注意的是，尽管 VMess 入站代理不需要使用传输层安全，但是在客户端上仍然需要选择使用 TLS 传输层安全来通过 VLESS 的回落。

## 客户端选择
客户端可以使用 [Qv2ray](https://github.com/Qv2ray/Qv2ray) 或 [v2rayN](https://github.com/2dust/v2rayN)，而 Android 上可以使用 [v2rayNG](https://github.com/2dust/v2rayNG)。内核使用 V2Ray 或 Xray 均可。 

- 若使用 V2Ray 内核，请确保内核版本在 v4.27.2~v4.33.0 之间。因为更新版本中，由于许可证原因移除了对 XTLS 的支持。

- - -
### 参考资料
- [Project X](https://xtls.github.io/)
- [SNI 回落 | Project X]()
- [Xray教程](https://tlanyan.pp.ua/xray-tutorial/)
- [V2ray的VLESS协议介绍和使用教程](https://tlanyan.pp.ua/introduce-v2ray-vless-protocol/)
- [Project X再爆与Qv2ray开发者大瓜](https://v2xtls.org/project-x%e5%86%8d%e7%88%86%e4%b8%8eqv2ray%e5%bc%80%e5%8f%91%e8%80%85%e5%a4%a7%e7%93%9c/)
