+++
name = "rsa-algorithm"
title = "RSA 算法"
tags = ["算法", "数论"]
date = "2022-02-08"
update = "2022-02-08"
enableGitalk = true
enableKatex = true
+++

## 前言
本来以前就想学习一下非对称加密算法中，大名鼎鼎的 [RSA 算法](https://zh.wikipedia.org/wiki/RSA%E5%8A%A0%E5%AF%86%E6%BC%94%E7%AE%97%E6%B3%95)，但是奈何本人当时不会数论，完全看不懂那些讲解。并且那些讲解往往都没有说清楚每一步在干什么，所以自然也没能理解 RSA 算法。  
近日看了一个[关于 RSA 算法的讲解视频](https://www.bilibili.com/video/BV1XP4y1A7Ui)，茅塞顿开，明白了 RSA 算法的基本原理。在这里就来记录一下自己对 RSA 算法的理解。

{{< notice note >}}
这篇文章**并不通俗易懂**，文章中含有大量数论相关内容。建议在阅读前先了解 [同余](https://zh.wikipedia.org/wiki/%E5%90%8C%E9%A4%98) 和 [欧拉定理](https://zh.wikipedia.org/wiki/%E6%AC%A7%E6%8B%89%E5%AE%9A%E7%90%86_(%E6%95%B0%E8%AE%BA))。
{{< /notice >}}

## 公钥和私钥
公钥和私钥都由一对数字组成，这里可以假定公钥为 $(N,e)$，私钥为 $(N,d)$。其中两个 $N$ 是相等的。  

使用公钥加密的内容可以用私钥解密，使用私钥加密的内容可以用公钥解密。不过由于公钥是公开的，因此私钥加密一般用于数字签名。公钥和私钥这一对密钥实际上没有什么本质的区别。区别仅在于一个是公开的，一个是不公开的。

## 加密和解密
### 加密
假设有明文 $x$，使用公钥对数据进行加密的过程，相当于将明文 $x$ 幂上 $e$ 并取除以 $N$ 的余数。这里加密所得的密文 $c$ 满足：
$$
c=x^e \bmod N
$$

### 解密
解密的过程实际上与加密是一样的，只不过使用的是私钥。使用私钥对数据进行解密的过程，相当于将密文 $c$ 幂上 $d$ 并取除以 $N$ 的余数。这里解密出的明文 $x'$ 满足：
$$
x'=c^d \bmod N=x^{ed} \bmod N=x
$$

这里可以发现密钥对是满足 $x^{ed} \bmod N =x$ 的，因此重点是需要找到一组数字 ${N, e, d}$ 满足上述情况。  

### 样例
例如有这么一对密钥，公钥为 $(33, 3)$，私钥为 $(33, 7)$。
1. 加密时，假设有明文 $x=25$ 需要加密，那么就将数据幂上公钥中的 3，得到密文 $c=x^3 \bmod 33=16$。
2. 解密时，就将密文幂上私钥中的 7，得到明文 $x'=c^7 \bmod 33=25$。

## 生成密钥对
生成一对密钥首先需要两个质数 $p,q$，将这两个质数相乘即得到了 $N$。  

这里还需要求出 $\varphi(N)$ 的值，这里设为 $T$，根据欧拉函数的积性特征可得：
$$
T=\varphi(p)\cdot \varphi(q)=(p-1)\cdot(q-1)
$$
而此时就可以开始计算公钥和私钥了，公钥 $e$ 和私钥 $d$ 满足：
$$
ed \equiv 1 \pmod T
$$
这里需要先选择出这个密钥对中的其中一个密钥 $e$，这里可以随便选，但选择出的密钥需要与 $T$ 互质，并且 $1<e<T$，这样才能保证能找到另一个密钥 $d$。当选出密钥 $e$ 之后就可以很容易地计算出另一个密钥 $d$ 了。

最后将 $N,e$ 封装成公钥，$N,d$ 封装成私钥，然后销毁掉 $p, q, T$ 这三个数字。  

如果 $p,q$ 取得足够大，那么其乘积 $N$ 也会变得非常大。想要找到一个大数的两个质因数十分困难，因此保证了 RSA 算法的安全性。

## 欧拉定理
### 互质情况
解密时：
$$
x^{ed}=x^{k\varphi(N)+1}=x(x^{\varphi(N)})^k
$$
根据欧拉定理，若 $x$ 与 $N$ 互质，则：
$$
x^{\varphi(N)}\equiv1 \pmod N
$$
可得：
$$
x^{ed}\equiv x(1)^k \equiv x \pmod N
$$
### 不互质情况
若 $x$ 与 $N$ 不互质，不妨设 $x=ap$，$ed-1=b(q-1)$，则可得：
$$
x^{ed}=ap^{ed}\equiv 0\equiv ap\equiv x \pmod p
$$
$$
x^{ed}=x(x^{ed-1})=x(x^{b(q-1)})=x(x^{q-1})^b=x(x^{\varphi(q)})^b\equiv x(1)^b \equiv x \pmod q
$$
整理后即是：
$$
x^{ed}\equiv x \pmod p
$$
$$
x^{ed}\equiv x \pmod q
$$
因此可以证明得到 $x^{ed} \equiv x \pmod N$。

## 样例
1. 先选择两个质数 $p=11,q=17$。    
2. 可以计算得到 $N=pq=187,T=(p-1)(q-1)=160$。
3. 随便选出一个公钥 $e=19$，计算可得私钥 $d=59$。
4. 假设有数据 $x=114$ 需要进行加密，那么 $c=x^{19} \bmod 187=113$。
5. 解密时 $x'=c^{59} \bmod 187=114$。

- - -
### 参考资料
- [RSA加密算法](https://zh.wikipedia.org/wiki/RSA%E5%8A%A0%E5%AF%86%E6%BC%94%E7%AE%97%E6%B3%95)
- [数学不好也能听懂的算法 - RSA加密和解密原理和过程](https://www.bilibili.com/video/BV1XP4y1A7Ui)
