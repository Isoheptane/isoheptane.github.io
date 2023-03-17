+++
title = "XTLS Vision 简介与配置"
tags = ["代理", "V2Ray"]
date = "2023-01-26"
update = "2023-03-17"
enableGitalk = true
+++

## 前言
又到了一年一度的折腾自己的 VPS 的时间了。给自己的域名续了费，然后换了新的 VPS 服务商。

其实前段时间就试过了 **XTLS Vision** 这项新技术，不过当时由于经常出现 [Secure Connection Failed](https://support.mozilla.org/en-US/kb/secure-connection-failed-firefox-did-not-connect) 而不得不转而使用其它的配置。不过这次配置，我打算将其投入实际应用中。

## XTLS
TLS (Transport Layer Security) 即传输层安全协议是一种被广泛应用的安全协议，用于保障通信的保密性和数据完整性。被 TLS 加密的数据可以认为是安全的。

[XTLS](https://github.com/RPRX/v2ray-vless/releases/tag/xtls) 基于 TLS，是主要是为了减少额外的加密而设计出来的一种传输层安全协议。

常规的代理协议在使用 TLS 连接时，如果代理的也是 TLS 流量（例如 HTTPS），那么原始数据将会经过**两层加密**。然而大多数的数据并不需要这样的两层加密，即使是单层 TLS 加密，审查者也无法解密数据。因此，在代理 TLS 流量时，握手完成之后发送的加密数据不需要再经过代理的 TLS 加密，可以原封不动地传输，从外面看起来就像一条普通的 TLS 连接。

因此，XTLS 做的实际上是在检测到建立了 TLS 连接并且完成了握手后，将被代理的 TLS 流量原封不动地转发，而不会再经过代理的 TLS 加密。这样做可以极大地降低加解密开销，提高代理的性能。同时，经过 XTLS 传输的 TLS 流量也*拥有几乎完美的流量特征*，因为流量并没有经过代理加工。

 XTLS 的其它流控方式存在[被主动探测和攻击的风险](https://github.com/e1732a364fed/xtls-/blob/main/README.md#%E5%85%B3%E4%BA%8Exray%E7%9A%84%E5%AE%89%E5%85%A8%E9%97%AE%E9%A2%98)，因此，这些流控方式已经被弃用。

## TLS over/in TLS
在建立起被代理的 TLS 连接之前，需要先进行 TLS 握手。对与的代理协议来讲，客户端会先对代理服务器发起代理请求，然后通过代理与目标服务器进行 TLS 握手。以 TLS 1.3 为例，在成功建立与代理服务器的 TLS 加密连接后，数据包发送的情况如下：

| 序号 | 方向 | 内容 | 长度 |
| :-: | :-: | :- | :-: |
| 1 | C -> S | 代理请求 | 很短 |
| 2 | C <- S | 代理请求同意 | 很短 |
| 3 | C -> S | TLS 1.3 Client Hello | 短 |
| 4 | C <- S | TLS 1.3 Server Hello | 长 |
| 5 | C -> S | TLS 1.3 Finished | 很短 |

尽管代理客户端到代理服务器的连接是安全的，审查者依然有可能通过其它的特征识别出 TLS over TLS。可以发现数据包的**传输方向**和**长度**都具有可以辨识的特征，而这些特征将有可能被用于检测 TLS over TLS，从而暴露代理。

## XTLS Vision
[XTLS Vision](https://github.com/XTLS/Xray-core/pull/1235) 是一种新的流控方式。XTLS Vision 主要解决了之前存在的安全漏洞，并针对握手过程中较短的数据包进行了填充，从而模糊了数据包的**长度特征**。但是对于**传输方向特征**，即**时序特征**，XTLS Vision 并没有做处理。对于审查者是否能够通过时序特征识别 TLS over TLS 连接，开发者们认为现在还不足以下定论。

{{< notice warning >}}
XTLS Vision 的特性仅在代理 TLS 1.3 连接时才会启用。

XTLS Vision 现在已支持检测客户端到代理服务器的 TLS 版本，当代理客户端与服务器协商的 TLS 版本较低时，服务器将会拒绝代理流量。在一些情况下存在协商到低版本 TLS 的可能性，在这样的情况下建议将 ``minVersion`` 设置为 1.3，强制客户端使用 TLS 1.3。
{{< /notice >}}

## 配置 XTLS Vision
### XTLS Vision 支持
| 名称 | 最低支持版本 |
| :-: | :-: |
| [Xray-core](https://github.com/XTLS/Xray-core) | 1.6.2 |
| [v2rayN](https://github.com/2dust/v2rayN) | 5.38 |
| [v2rayNG](https://github.com/2dust/v2rayNG) | 1.7.31 |

请注意更新 Xray-core 到新版本。

### 配置
具体的配置可以参考[配置 VLESS+TCP+XTLS](https://blog.cascade.moe/posts/vless-proxy-setup/#配置-nginx-流量伪装)，这篇文章中的配置过程和 XTLS Vision 大同小异，仅有入站代理配置不同。这里贴出 ``inbound`` 中的入站代理配置：
```json
{
    "tag": "xtls-vision",
    "listen": "0.0.0.0",
    "port": 443,
    "protocol": "vless",
    "settings": {
        "clients": [
            {
                "id": "your-uuid",
                "flow": "xtls-rprx-vision"
            }
        ],
        "fallbacks": [
            {
                "dest": 80
            }
        ],
        "decryption": "none"
    },
    "streamSettings": {
        "network": "tcp",
        "security": "tls",
        "tlsSettings": {
            "serverName": "your.domain",
            "certificates": [
                {
                    "certificateFile": "/path/to/cert.pem",
                    "keyFile": "/path/to/privkey.pem"
                }
            ],
            "alpn": ["h2", "http/1.1"]
        }
    }
}
```

请注意，在使用 XTLS Vision 时，传输层安全应设置为 **TLS** 而非 XTLS。

为了防御主动探测，配置回落进行伪装同样是必要的。这里的配置样例将会回落到本机的 80 端口，你可以根据自己的需求修改回落配置。

{{< notice tip >}}
客户端还可以开启 **uTLS** 来伪造 TLS Client Hello 指纹。代理软件客户端的 TLS Client Hello 指纹被指出可能与[中国大规模地封锁基于TLS的翻墙服务器](https://github.com/net4people/bbs/issues/129)有关。
{{< /notice >}}

- - -
### 参考资料
- [XTLS Vision, TLS in TLS, to the star and beyond](https://github.com/XTLS/Xray-core/discussions/1295)
- [划时代的革命性概念与技术：XTLS](https://github.com/RPRX/v2ray-vless/releases/tag/xtls)
