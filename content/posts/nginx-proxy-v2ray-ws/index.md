+++
title = "配置 Nginx 流量伪装并反向代理 V2Ray+WebSocket"
tags = ["代理", "Nginx", "V2Ray"]
date = "2022-05-01"
update = "2022-08-29"
enableGitalk = true
+++

## 前言
某一天，群友告诉我梯子炸了，试了一下果然如此，被 GFW 封了443端口。但是 VLESS+TCP+XTLS 可是所谓的“终极形态”啊，怎么会这么容易地被发现呢？也许是我的问题，也许是 XTLS 或者 VLESS 的问题。但是无论怎么样，我们都需要更隐蔽的代理方式。  

于是，我选择了最经典的 Nginx 流量伪装的 V2Ray+WebSocket 这种方式。

## 原理
Nginx 是一个高性能的 HTTP 和 Web 反向代理服务器。在这里将会像 [配置 VLESS+TCP+XTLS + Nginx 流量伪装 + VMess 回落](/posts/vless-proxy-setup) 这篇文章一样配置一个伪装站点，配置伪装内容的站点不在赘述。  

Nginx 可以反向代理 WebSocket 流量，因此可以配置 Nginx 将请求转发至后端的 V2Ray 服务器。  

### 分流
Nginx 要怎么区别哪些是网站的请求，哪些是代理请求呢？这个时候便需要用 Nginx 的 ``location`` 了。``location`` 可以用来匹配访问**不同路径**的请求，进而对不同路径的请求进行不同的处理。  

因此可以为不同的路径配置不同的处理方式，来将特定路径的请求代理到 V2Ray 服务器上。

### 代理
Nginx 反向代理可以使用 ``proxy_pass`` 这一属性，设置代理请求到其它的服务器上。对于特定路径 `/specific/path` 的格式如下：

```nginx
location /specific/path/ {
	proxy_pass http://targetserver.com:12345;
    # 使用 HTTPS 也是可以的
    # proxy_pass https://targetserver.com:12346;
}
```

## 配置 V2Ray
这里以 Trojan 协议为例：

```json
{
    "tag": "in-proxy-trojan",
    "protocol": "trojan",
    "listen": "127.0.0.1",
    "port": 10000,
    "settings": {
        "clients": [
            {
                "password": "YourPassword"
            }
        ]
    },
    "streamSettings": {
        "network": "ws",
        "wsSettings": {
            "path": "/yourpath/trojan"
        }
    }
}
```

后端的 V2Ray 服务器设置为监听本地连接。因为是本地连接，所以没有必要使用 TLS。WebSocket 需要匹配访问的路径，因此还需要设置好路径。  

你也可以设置多个入站代理来支持多种协议。

## 配置 Nginx
Nginx 此时需要打开 SSL/TLS 来保证连接的安全性。由于之前已经配置好了服务器的其它部分，因此这里只给出特定路径部分的配置：

```nginx
server
{
    listen 443 ssl; # 监听 SSL/TLS 连接
    location /yourpath/trojan {
		proxy_pass http://127.0.0.1:10000;
		proxy_intercept_errors on;
		error_page 400 = https://name.yourdomain/;
		# 代理 WebSocket 连接
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
		# 传递客户端 IP 地址
		proxy_set_header X-Real-IP $remote_addr;
    	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	}
    # ...
}
```

### 设置代理 WebSocket 连接
由于 WebSocket 使用 HTTP/1.1，因此 Nginx 访问后端的 V2Ray 服务器时需要使用 HTTP/1.1 协议。添加如下设置：

```nginx
proxy_http_version 1.1;
```

建立 WebSocket 连接时，客户端会请求将连接升级为 WebSocket，因此还需要使 Nginx 与后端服务器建立 WebSocket 连接。在此需要设置 Nginx 访问 V2Ray 服务器时的请求头，添加如下设置：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

同时为了防止长时间没有数据发送导致 Nginx 切断连接，这里还可以设置超时时间：

```nginx
proxy_read_timeout 600s;
```

### 传递客户端 IP 地址
由于是 Nginx 访问后端服务器，因此后端服务器并不知道客户端的真实 IP 地址。如果想要让后端服务器知道客户端的 IP 地址，同样需要设置请求头。添加如下设置：

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### 捕获后端服务器的 400 Bad Request 响应
当通过不正确的方式访问 WebSocket 的路径时，后端服务器会响应 ``400 Bad Request``。这对 GFW 来讲是一种可能可以被探测到的特征，因此可以设置 Nginx 捕获后端服务器的 ``400 Bad Request`` 响应，并跳转到其它位置。这里以跳转到主页为例，添加如下设置：

```nginx
proxy_intercept_errors on;
error_page 400 = https://name.yourdomain/;
```

此时访问 ``https://name.yourdomain/yourpath/trojan`` 时将会跳转到 ``https://name.yourdomain`` 上。  

## 配置客户端
客户端的配置比较简单，请注意选择 WebSocket 协议并使用 TLS 传输层安全，并且将你选择的路径填写到路径选项中。

- - -
### 参考资料
- [Use NGINX as a WebSocket Proxy](https://www.nginx.com/blog/websocket-nginx/)
