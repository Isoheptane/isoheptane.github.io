+++
name = "secure-boot"
title = "实施 Secure Boot"
tags = ["Secure Boot", "UEFI"]
date = "2023-06-25"
update = "2023-06-25"
enableGitalk = true
+++

### 前言
在 [使用统一内核映像 (UKI) 引导 Linux](/posts/uki-linux-boot/) 这篇文章中，我讲解了如何创建并引导 UKI。既然我们已经能够创建和引导 UKI 了，为什么不试着对 UKI 签名，使其能够在开启了 Secure Boot 的平台上被引导呢？

尽管对于大多数人来讲，开启 Secure Boot 是非必须的，但我还是~~想给自己找点罪受~~想折腾一下，所以我还是选择了在自己的设备上实现 Secure Boot。

## Secure Boot
Secure Boot 是 UEFI 标准的一部分。Secure Boot 通过在加载 EFI 二进制文件（UEFI 固件、UEFI 驱动程序、UEFI 应用程序、 Bootloader 等）前**检查其数字签名来确保只有受信任的 EFI 二进制文件被加载**，以此阻止在正常引导前加载未信任的 EFI 二进制文件。由于在引导操作系统前就被加载的程序具有相当高的权限，能够直接访问硬件，因此通过在引导操作系统前加载恶意软件来执行攻击是可行的。而 Secure Boot 能够阻止恶意软件在引导操作系统前被加载，因此能够防御这类攻击 (如 Rootkit)。

对于厂商来讲，Secure Boot 能够确保只有受 OEM 信任的软件被加载，阻止用户对设备进行调试或对私有软件进行读写等高权限操作，因此许多整机制造商会在自己的产品中启用 Secure Boot。而对于大多数主板制造商，其面向 DIY 市场的产品往往默认关闭 Secure Boot，同时启用兼容性支持模块 (CSM) 来实现对旧的 BIOS 启动的兼容性。

### Secure Boot 使用的密钥
Secure Boot 使用的密钥通常以 UEFI 变量的形式被存储在设备的 NVRAM 中。UEFI 变量是一个键值对，包含了识别信息（键）和数据（值），能够在 UEFI 环境、Bootloader 和其他应用程序之间共享数据。

Secure Boot 的验证过程会使用在**设备中存储的证书**（公钥）来验证被加载的 EFI 二进制文件，被加载的 EFI 二进制文件则需要**被受信任的证书对应的私钥签名**。

在 Secure Boot 的实现中会用到这些密钥和数据库：
#### 平台密钥 (PK)
PK 是最高级的密钥，主要用于**对设备上 KEK 证书的更新签名**。设备制造商通常会安装一个制造商的 PK 证书，但它也可以被用户替换。在一个设备上只能安装一个 PK 证书。

#### 密钥交换密钥 (KEK)
KEK 是次级的密钥，主要用于**对设备上 db/dbx 的更新签名**。在一个设备上可以安装多个 KEK 证书。

#### 签名数据库 (db)
db 中存储了**受信任的证书和 Hash**。如果一个 EFI 二进制文件经过了 db 中的证书对应的私钥签名或其 Hash 存在于 dbx 中，则这个 EFI 二进制文件是可信的。

在本文中，db 中存储的证书也可被称作 db 证书，与之对应的密钥对则称之为 db 密钥。db 密钥主要用于**对 EFI 二进制文件签名**。

#### 已吊销签名数据库 (dbx)
dbx 中存储**不再受信任的证书和 Hash**。如果一个 EFI 二进制文件经过了 dbx 中的证书对应的私钥签名其 Hash 存在于 dbx 中，则这个 EFI 二进制文件是不可信的。

### 设置模式和用户模式
设备上的 PK 证书被清除后，UEFI 固件将进入设置模式。在设置模式下，不需要鉴权即可向设备写入 PK 证书、KEK 证书或修改签名数据库。 

向设备安装 PK 证书后，UEFI 固件将进入用户模式。在用户模式下，对 PK 证书、 KEK 证书、db 和 dbx 的更新**需要经过更高一级密钥的签名**，即：
- 对 db, dbx 的更新需要经过 KEK 或 PK 的签名
- 对 KEK 证书的更新需要经过 PK 的签名

特别地，对 PK 证书的修改需要经过旧的 PK 的签名。

### 默认证书
在支持 Secure Boot 的设备上，设备制造商可能会预先安装这些证书：
- 来自设备制造商的 PK 证书和 KEK 证书
- 来自微软的 KEK 证书和 db 证书
- dbx 证书（不信任的证书）

在面向 DIY 市场的设备上，Secure Boot 的证书大多数来自微软，包含三个证书：
- [微软 KEK CA 2011 证书](https://go.microsoft.com/fwlink/?LinkId=321185)，该证书是一个 KEK 证书。若要允许微软修改用户设备的 db 和 dbx，则需要安装该证书。主要用于向 dbx 中添加不再受信任的证书和 Hash，也可能会用于向 db 中添加新的证书。
- [微软 UEFI CA 2011 证书](https://go.microsoft.com/fwlink/p/?linkid=321194)，该证书是一个 db 证书。若要**加载经过微软的密钥签名的第三方软件**，如 UEFI 固件、UEFI 驱动、Bootloader 等，则需要安装该证书。
- [微软 Windows 产品 PCA 2011 证书](https://go.microsoft.com/fwlink/p/?linkid=321192)，该证书是一个 db 证书。若要**加载 Windows**，则需要安装该证书。

除此之外，微软还在 2023 年添加了新的证书：
- [微软 KEK 2K CA 2023 证书](https://go.microsoft.com/fwlink/?linkid=2239775)
- [微软 UEFI CA 2023 证书](https://go.microsoft.com/fwlink/?linkid=2239872)
- [Windows UEFI CA 2023 证书](https://go.microsoft.com/fwlink/?linkid=2239776)

## 实施 Secure Boot 的方式
### 使用自己的密钥与证书
在设备上安装自己的 PK 证书和 KEK 证书，并使用自己的 db 密钥来对 EFI 二进制文件签名。

### 使用已签名的 Bootloader
使用已签名的 Bootloader 如 [shim](https://aur.archlinux.org/packages/shim-signed) 来加载其他 EFI 二进制文件。但 shim 同样不会自动加载未签名的 EFI 二进制文件，它使用了**机器所有者密钥列表 (MokList)**。当被加载的 EFI 二进制文件经过了 MokList 中的公钥对应的私钥签名或其 Hash 存在于 MokList 中时，Bootloader 才会加载这个 EFI 二进制文件。否则，Bootloader 会启动一个密钥管理工具，这个工具可以用于添加密钥或 Hash。

## 实施 Secure Boot
下面将会介绍使用自己的密钥和证书来实施 Secure Boot。接下来的步骤中，大部分的操作会需要用到 [`efitools`](https://archlinux.org/packages/extra/x86_64/efitools/) 和 [`sbsigntools`] 中的指令。

### 备份 UEFI 变量
在安装自己的 Secure Boot 证书前，你也许会希望备份设备上原有的证书，以便在配置错误时恢复配置前的证书设置。

运行下面的指令来读取当前的 UEFI 变量中存储的证书，并保存到文件中：

```bash-session
$ for var in PK KEK db dbx ; do efi-readvar -v $var -o old_${var}.esl ; done
```

### 进入设置模式
设备上的 PK 证书被清除后，UEFI 固件将处于设置模式。要清除 PK 证书，通常需要进入 UEFI 固件设置工具（即常说的 BIOS 设置）中，找到与 Secure Boot 相关的选项并清除设备上已安装的 Secure Boot 证书。在一些主板上，Secure Boot 相关的选项可能在 Windows OS Configuration 中。

{{< notice note >}}
至少需要安装 PK 证书才能启用 Secure Boot，因此在清除 PK 证书后设备需要被设置为禁用 Secure Boot。但即使 Secure Boot 被禁用，依然可以管理 Secure Boot 证书。
{{</ notice >}}

### 生成密钥和证书
下面将会介绍如何手动生成密钥。你也可以通过 [`sbctl`](https://archlinux.org/packages/?name=sbctl) 来辅助生成密钥。
#### 不同格式的文件
在密钥的生成过程中，会用到这些格式的文件：
- **.key**: PEM 格式的**私钥**，用于对 EFI 二进制文件和 EFI 签名列表签名。
- **.crt**: PEM 格式的**证书**，用于签名和验证。
- **.cer**: DER 格式的**证书**，可以被安装到设备上。
- **.esl**: 包含证书的 **EFI 签名列表**，可以被安装到设备上。
- **.auth**: **经过签名的 EFI 证书列表**，可以用于在用户模式下更新证书。

#### 生成 GUID
GUID 用于识别证书的所有者，因此在这里首先生成一个包含 GUID 的文件：

```bash-session
$ uuidgen --random > GUID.txt
```

#### 生成 PK
```bash-session
> # 使用 OpenSSL 生成 PK
$ openssl req -newkey rsa:4096 -nodes -keyout PK.key -new -x509 -sha256 -days 3650 -subj "/CN=my Platform Key/" -out PK.crt
> # 将 PEM 格式的证书转换为 DER 格式的证书
$ openssl x509 -outform DER -in PK.crt -out PK.cer
> # 将 PK 证书转换为 EFI 签名列表
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" PK.crt PK.esl
> # 对包含 PK 证书的 EFI 签名列表使用 PK 签名
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k PK.key -c PK.crt PK PK.esl PK.auth
```

除此之外，你还可以生成一个空白的 `noPK.auth` 文件，用于在用户模式下清除 PK 证书：

```bash-session
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k PK.key -c PK.crt PK /dev/null noPK.auth
```

#### 生成 KEK
```bash-session
> # 使用 OpenSSL 生成 KEK
$ openssl req -newkey rsa:4096 -nodes -keyout KEK.key -new -x509 -sha256 -days 3650 -subj "/CN=my Key Exchange Key/" -out KEK.crt
> # 将 PEM 格式的证书转换为 DER 格式的证书
$ openssl x509 -outform DER -in KEK.crt -out KEK.cer
> # 将 KEK 证书转换为 EFI 签名列表
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" KEK.crt KEK.esl
> # 对包含 KEK 证书的 EFI 签名列表使用 PK 签名
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k PK.key -c PK.crt KEK KEK.esl KEK.auth
```

#### 生成 db 密钥
```bash-session
> # 使用 OpenSSL 生成 db 密钥
$ openssl req -newkey rsa:4096 -nodes -keyout db.key -new -x509 -sha256 -days 3650 -subj "/CN=my Signature Database key/" -out db.crt
> # 将 PEM 格式的证书转换为 DER 格式的证书
$ openssl x509 -outform DER -in db.crt -out db.cer
> # 将 db 证书转换为 EFI 签名列表
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" db.crt db.esl
> # 对包含 db 证书的 EFI 签名列表使用 KEK 签名
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db db.esl db.auth
```

### 添加或更新证书
如果你需要在用户模式下更新证书，则需要**对证书更新签名**。下面以更新 db 证书为例：

```bash-session
> # 将 db 证书转换为 EFI 签名列表
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" new_db.crt new_db.esl
> # 对包含 db 证书的 EFI 签名列表使用 KEK 签名
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db new_db.esl new_db.auth
```

如果需要添加新的证书，而不是替换原有的证书，则需要在签名时添加选项 `-a`：

```bash-session
$ sign-efi-sig-list -a -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db new_db.esl new_db.auth
```

### 添加其它证书
{{< notice warning >}}
这一步很重要！许多 UEFI 固件都经过了微软的密钥或其制造商的密钥签名，如果仅安装你自己的 db 证书并启用了 Secure Boot，**UEFI 固件可能无法被加载，导致设备变砖**。

笔者在操作时就犯了这个错误，最终通过重刷 BIOS 和清空 CMOS 才就救回来。
{{</ notice >}}

#### 添加来自微软的证书
下载了来自微软的证书后，首先需要将证书转换为 EFI 证书列表，这里以 2011 年版本的证书为例：

{{< notice note >}}
在这里我们将 GUID 设置为了 `77fa9abd-0359-4d32-bd60-28f4e78f784b`，这是微软的所有者 GUID。
{{</ notice >}}

```bash-session
$ cert-to-efi-sig-list -g 77fa9abd-0359-4d32-bd60-28f4e78f784b MicWinProPCA2011_2011-10-19.crt MS_Win_db.esl
$ cert-to-efi-sig-list -g 77fa9abd-0359-4d32-bd60-28f4e78f784b MicWinProPCA2011_2011-10-19.crt MS_UEFI_db.esl
```

将两个 EFI 证书列表合并为一个 EFI 证书列表：

```bash-session
$ cat MS_UEFI_db.esl MS_Win_db.esl > MS_db.esl
```

使用自己的 KEK 对 EFI 证书列表签名：

```bash-session
$ sign-efi-sig-list -a -g 77fa9abd-0359-4d32-bd60-28f4e78f784b -k KEK.key -c KEK.crt db MS_db.esl add_MS_db.auth
```

为了严格符合的微软 UEFI 安全启动要求，可以选择添加来自微软的 KEK。这里以 2011 年版本的证书为例，首先将来自微软的 KEK 证书转换为 EFI 证书列表，然后使用自己的 PK 对 EFI 证书列表签名：

```bash-session
$ cert-to-efi-sig-list -g 77fa9abd-0359-4d32-bd60-28f4e78f784b MicCorKEKCA2011_2011-06-24.crt MS_KEK.esl
$ sign-efi-sig-list -a -g 77fa9abd-0359-4d32-bd60-28f4e78f784b -k PK.key -c PK.crt KEK MS_KEK.esl add_MS_KEK.auth
```

#### 添加设备上原有的证书
还记得刚才备份的 UEFI 变量吗？其中包含了设备上原有的证书。在这里可以通过使用自己的 KEK 对原有的 EFI 签名列表进行签名，然后添加原有的 db 证书：

```bash-session
$ sign-efi-sig-list -a -g -k KEK.key -c KEK.crt db old_db.esl add_MS_db.auth 
```

如果设备上还包含了其他的 db 证书，同样可以使用这种方式来安装。

### 对 EFI 二进制文件进行签名
用下面的指令为一个 EFI 二进制文件签名：

```bash-session
$ sbsign --key db.key --cert db.crt --output file.efi file.efi
```

用下面的指令验证一个 EFI 二进制文件的签名：

```bash-session
$ sbverify --cert db.crt file.efi
```

#### 使用 mkinitcpio Post hooks 来自动为 UKI 签名
Post hooks 是在 mkinitcpio 创建一个映像之后会自动执行的可执行文件或脚本，执行时，第一个参数为内核的路径、第二个参数为产生的 initramfs 映像的路径、第三个参数为 UKI 的路径。

在这里以使用 mkinitcpio 生成 UKI 为例，使用 mkinitcpio Post hooks 来自动为创建的 UKI 签名。

创建文件 `/etc/initcpio/post/uki-sbsign`，将其设置为可执行，并在其中写入如下的内容：

```bash
#!/usr/bin/env bash

uki="$3"
[[ -n "$uki" ]] || exit 0

keypairs=(/path/to/your/db.key /path/to/your/db.crt)

for (( i=0; i<${#keypairs[@]}; i+=2 )); do
    key="${keypairs[$i]}" cert="${keypairs[(( i + 1 ))]}"
    if ! sbverify --cert "$cert" "$uki" &>/dev/null; then
        sbsign --key "$key" --cert "$cert" --output "$uki" "$uki"
    fi
done
```

### 安装证书
在这里我会介绍两种安装 (enroll) 证书的方式。

{{< notice tip >}}
如果不需要安装 dbx 证书，则可以在后面的步骤中忽略。
{{</ notice >}}

{{< notice warning >}}
向设备中安装 PK 证书会**使设备返回用户模式**，因此推荐在最后安装 PK 证书。

如果 `KEK.auth` 没有经过有效的签名，则在安装 PK 证书后会无法安装 `KEK.auth` 中包含的 KEK 证书。
{{</ notice >}}

#### 使用 sbkeysync
sbsigntools 提供了 `sbkeysync` 来更新设备上已安装的证书。

首先创建需要的目录：

```bash-session
$ mkdir -p /etc/secureboot/keys/{db,dbx,KEK,PK}
```

然后将在先前的步骤中产生的 `.auth` 文件复制到对应的目录中。如将 `PK.auth` 复制到 `/etc/secureboot/keys/PK/` 中，将 `add_MS_db.auth` 复制到 `/etc/secureboot/keys/db/` 中。

使用 `--dry-run` 来确认 sbkeysync 会产生的修改：

```bash-session
$ sbkeysync --pk --dry-run --verbose
```

Linux 内核通过 [**efivarfs**](https://wiki.archlinux.org/title/Unified_Extensible_Firmware_Interface#UEFI_variables_support_in_Linux_kernel) 来使 UEFI 变量对用户空间可见。通常情况下，efivarfs 会被自动挂载到 `/sys/firmware/efi/efivars`。而 sbkeysync 通过修改 `/sys/firmware/efi/efivars` 中的文件来操作 UEFI 变量，以此达到更新证书的目的。但 sbkeysync 要修改的文件在默认情况下具有 `i` 属性（不可修改），因此需要使用 `chattr` 来临时去除文件的 `i` 属性，以便 sbkeysync 更新证书。

用下面的指令来去除相关变量的 `i` 属性：

```bash-session
chattr -i /sys/firmware/efi/efivars/{PK,KEK,db}*
```

最后用下面的指令安装证书：

```bash-session
$ sbkeysync --verbose
$ sbkeysync --verbose --pk
```

然后再尝试安装证书。

#### 使用 UEFI 固件设置工具
一些 UEFI 固件允许通过 UEFI 固件设置工具来管理设备上安装的证书。

由于许多 UEFI 固件**仅支持读写 FAT 文件系统**，因此需要将要安装的证书放在一个 FAT 文件系统上。将要安装的证书放在 EFI 系统分区中也是可行的。

首先将**除 `noPK.auth` 外**的所有 `.cer`, `.esl`, `.auth` 文件复制到一个 FAT 文件系统上。然后重启设备，进入 UEFI 固件设置工具。在 UEFI 固件设置工具中找到与 Secure Boot 相关的选项，并选择从外部存储中安装证书。在选择了对应的文件后，UEFI 固件可能会询问这个文件的类型，常见的选项有这些：
- **Key Certificate Blob**, 即**二进制证书对象**，对应 `.cer` 格式的文件。
- **UEFI Secure Variable**, 即 **UEFI 安全变量**，对应 `.esl` 格式的文件。
- **Authenticated Variable**, 即**经过签名的 UEFI 变量**，对应 `.auth` 格式的文件。

如果固件设置工具支持，则推荐使用 `.auth` 格式的文件。

### 启用 Secure Boot
最后在 UEFI 固件设置工具中重新启用 Secure Boot，然后重启设备。如果配置没有问题，设备将会正常引导操作系统。

如果设备无法正常引导操作系统，也无法进入 UEFI 固件设置工具中，可能是因为 UEFI 固件经过了特定 db 密钥签名，而对应的证书没有安装。此时可以尝试重新刷入 UEFI 固件。

到这里，在自己的设备上使用自己的密钥实现 Secure Boot 的操作就结束了。

### 结语
不得不说，把这篇文章写出来还真是费了好大的劲。在此之前我对 Secure Boot 并没有太多概念，只知道 Secure Boot 确保了只有被签名的映像和驱动才能被加载。

后来看到了 ArchWiki 上 [UKI](https://wiki.archlinux.org/title/UKI) 的条目，里面有关于对 UKI 签名的内容。秉承着~~想给自己找点罪受~~想折腾的想法，就在自己的设备上折腾了一下 Secure Boot。那天差点以为自己把自己主板刷成砖了，被吓得不轻，然后晚上又是折腾 ZFS 存储池的问题。总之那天是字面意义上的折腾了一天。

折腾完了之后就在想写一篇关于 Secure Boot 的文章，于是就有了这篇文章。这篇文章可是写了足足两天半~~虽然中间经常摸鱼~~，篇幅比 ZFS 那一篇还要长。期间查找了很多资料，修改了很多不易理解的地方，不过最后还是写出来了。

最后，谢谢能够看到这里的读者，希望这篇文章能够对你有所帮助。

- - -
### 参考资料
- [Unified Extensible Firmware Interface/Secure Boot - ArchWiki](https://wiki.archlinux.org/title/Unified_Extensible_Firmware_Interface/Secure_Boot)
- [UEFI/安全启动 - Arch Linux 中文维基](https://wiki.archlinuxcn.org/wiki/UEFI/%E5%AE%89%E5%85%A8%E5%90%AF%E5%8A%A8)
- [Secure Boot | Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-secure-boot)
- [Unified Extensible Firmware Interface (UEFI) Specification (March 2021)](https://uefi.org/sites/default/files/resources/UEFI_Spec_2_9_2021_03_18.pdf)
- [UEFI Secure Boot in Modern Computer Security Solutions (Aug 2019)](https://uefi.org/sites/default/files/resources/UEFI_Secure_Boot_in_Modern_Computer_Security_Solutions_2019.pdf)
- [A Tour Beyond BIOS Implementing UEFI Authenticated Variables in SMM with EDKII (Oct 2015)](https://raw.githubusercontent.com/tianocore-docs/Docs/master/White_Papers/A_Tour_Beyond_BIOS_Implementing_UEFI_Authenticated_Variables_in_SMM_with_EDKII_V2.pdf)
- [UEFI - Wikipedia](https://en.wikipedia.org/wiki/UEFI#Secure_Boot)
- [Windows Secure Boot Key Creation and Management Guidance | Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-secure-boot-key-creation-and-management-guidance?view=windows-11)
- [mkinitcpio.8 About Post Hooks](https://man.archlinux.org/man/mkinitcpio.8#ABOUT_POST_HOOKS)