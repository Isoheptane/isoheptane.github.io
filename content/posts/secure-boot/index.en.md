+++
name = "secure-boot"
title = "Implementing Secure Boot"
tags = ["Secure Boot", "UEFI"]
date = "2023-06-25"
update = "2023-06-25"
enableGitalk = true
+++

### Foreword
In my article [Boot Linux using Unified Kernel Image](/en/posts/uki-linux-boot/), I introduced UKI. Now we can create and boot UKI, why don't we try to sign UKI to make it bootable on platform with Secure Boot enabled?

Although for most people, Secure Boot is not necessary. But I still want to have a try on it, so I tried implementing it on my machine.

## Secure Boot
Secure Boot is a part of UEFI standard. It ensures that **only trusted EFI binaries are loaded** by **verifying their digital signatures** before loading EFI binaries (UEFI firmware, UEFI driver, UEFI applications, bootloaders, etc.). This prevents untrusted EFI binaries from being loaded before booting up the OS. Since programs loaded the OS are privilleged and can directly access hardwares, therefore it's possible to perform attacks by loading malwares ahead of the OS. Secure Boot blocks untrusted malwares, therefore it provides protection against such type of attack (Rootkit).

For manufacturers and vendors, Secure Boot ensures that only softwares trusted by OEMs can be loaded, preventing users from privilleged operations like debugging the device or reading proprietary softwares. Thus many PC/Mobile Phone manufacturers and vendors will keep Secure Boot enabled. For many motherboard manufacturers however, their products for DIY markets usually have Secure Boot disabled by default while also enabling Compatibility Support Module to support legacy BIOS boot.

### Keys in Secure Boot
Keys used in Secure Boot are usually stored as UEFI variables in NVRAM of the device. An UEFI variable is a key-value pair containing identity (key) and data (value). It can be used to share data among UEFI environment, bootloaders and other applications.

The verification process uses **certificates stored in the device** (public key) to verify EFI binaries being loaded. The EFI binary should be **signed by corresponding private key of trusted certificates**.

Following keys and databases will be used by Secure Boot:

#### Platform Key (PK)
Platform Key is the top-level key. It's usually used to **sign updates of KEK certificates**. Device manufacturers will usually install their own certificate, but it can be replaced by the users' certificate. One device has only one PK certificate.

#### Key Exchange Key (KEK)
KEK is lower than PK. They are used to **sign updates of db/dbx certificates**. One device can have multiple KEK certificates.

#### Signature Database (db)
db stores **trusted certificates and hashes**. If an EFI binary is signed by corresponding private key of certificates in db or its hash is in db, then this EFI binary is trusted.

In this article, certificates in db are referred to as **db certificates**, corresponding private keys are referred to as **db keys**. db keys are mainly used to sign EFI binaries.

#### Forbidden Signature Database (dbx)
dbx stores **untrusted certificates and hashes**. If an binary is signed by corresponding private key of certificates in dbx or its hash is in dbx, then this EFI binary is untrusted.

### Setup Mode and User Mode
When PK certificate is cleared, UEFI firmware will go to setup mode. Under setup mode, no authentication required to make updates to PK certificate, KEK certificates and db/dbx.

After installing a PK certificate, UEFI firmware will enter user mode. Under user mode, updates to PK certificate, KEK certificates and db/dbx will require signature of higher-level keys, which means:
- Updates to db, dbx will require signatures from KEK or PK
- Updates to KEK will require signature form PK

For PK, update to PK will require signature from old PK.

### Default Certificates
On devices supporting Secure Boot, manufacturers may pre-install these certificates
- PK certificate and KEK certificate from the device manufacturer
- KEK certificate and db certificates from Microsoft
- dbx certificates (untrusted certificates)

For devices facing DIY market, Secure Boot certificates are mostly from Microsoft. It may contain these three certificates:
- [Microsoft Corporation KEK CA 2011](https://go.microsoft.com/fwlink/?LinkId=321185). This certificate allows Microsoft to modify db and dbx on users' devices. This certificate may be used to add untrusted certificates and hashed to dbx or add new certificates to db.
- [Microsoft Corporation UEFI CA 2011](https://go.microsoft.com/fwlink/p/?linkid=321194). This is a db certificate. To load **third-party softwares signed by microsoft** like UEFI firmware, UEFI drivers, bootloaders, etc., this certificate should be installed.
- [Microsoft Windows Production PCA 2011](https://go.microsoft.com/fwlink/p/?linkid=321192). This is a db certificate. To **boot Windows**, this certificate should be installed.

Besides, Microsoft also published their new certificates in 2023:
- [Microsoft Corporation KEK 2K CA 2023](https://go.microsoft.com/fwlink/?linkid=2239775)
- [Microsoft UEFI CA 2023](https://go.microsoft.com/fwlink/?linkid=2239872)
- [Windows UEFI CA 2023](https://go.microsoft.com/fwlink/?linkid=2239776)

{{< notice note >}}
Microsoft Corporation KEK CA 2011 is set to expire in 2026.
{{</ notice >}}

## Ways to Setup Secure Boot
### Using Your Own Keys and Certificates
Install your own PK certificate and KEK certificates, then sign EFI binaries with your own db keys.

### Using Signed Bootloaders
Using signed bootloaders like [shim](https://aur.archlinux.org/packages/shim-signed) to load other EFI binaries. shim won't load EFI binaries without a valid signature. It uses **Machine Owner Key List (MokList)**. EFI binaries will be loaded only when the binray is signed with corresponding privates keys of public keys in MokList or its hash is in MokList. Otherwise bootloader will refuse to load the EFI binary. You can manage MokList using tools provided by the bootloader.

## Implementing Secure Boot
Now I will demonstrate how to set up Secure Boot using own keys and certificates. In next steps, they will require commands provided by [`efitools`](https://archlinux.org/packages/extra/x86_64/efitools/) and [`sbsigntools`].

### Backup UEFI Variables
Before installing your certificates, you may want to backup existing certificates in order to restore Secure Boot certificates when you failed to set up Secure Boot. 

Run following command to read certificates currently stored in UEFI variables and store them in files. 

```bash-session
$ for var in PK KEK db dbx ; do efi-readvar -v $var -o old_${var}.esl ; done
```

### Enter Setup Mode
When PK certificates is cleared, UEFI firmware will enter setup mode. To clear PK certificate, go to the UEFI firmware configuration tool (aka. BIOS settings), find options related to Secure Boot and clear certificates that are already installed. On some motherboards, Secure Boot options may be inside Windows OS Configuration menu.

{{< notice note >}}
PK certificate should be installed to enable Secure Boot, therefore after clearing PK certificate, Secure Boot should be disable. But even if Secure Boot is disabled, it's still possible to manage Secure Boot certificates.
{{</ notice >}}

### Generate Keys and Certificates
Following steps will demonstrate how to manually generate keys and certificates. You can also generate keys througth tools like [`sbctl`](https://archlinux.org/packages/?name=sbctl).

#### Formats of Keys
We will use these kinds of keys:
- **.key**: **Private Key** in PEM format, it will be used to sign EFI binaries and EFI signature list.
- **.crt**: **Certificate** in PEM format, it will be used to sign and verify.
- **.cer**: **Certificate** in DER format, can be installed to devices.
- **.esl**: **EFI Signature List** that contains certificates, can be installed to devices.
- **.auth**: **Signed EFI Signature List**, can be used to update certificates under user mode.

#### Generate GUID
GUID is used to identify certificate owner, here we generate a file contains our GUID:

```bash-session
$ uuidgen --random > GUID.txt
```

#### Generate PK
```bash-session
> # Generate PK using OpenSSL
$ openssl req -newkey rsa:4096 -nodes -keyout PK.key -new -x509 -sha256 -days 3650 -subj "/CN=my Platform Key/" -out PK.crt
> # Convert PEM certificate into DER certificate
$ openssl x509 -outform DER -in PK.crt -out PK.cer
> # Convert PEM certificate into EFI signature list
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" PK.crt PK.esl
> # Sign EFI signature list containing PK certificate with PK
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k PK.key -c PK.crt PK PK.esl PK.auth
```

You can also generate and sign an empty `noPK.auth` file, which can be used to clear PK certificate under user mode.

```bash-session
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k PK.key -c PK.crt PK /dev/null noPK.auth
```

#### Generate KEK
```bash-session
> # Generate KEK using OpenSSL
$ openssl req -newkey rsa:4096 -nodes -keyout KEK.key -new -x509 -sha256 -days 3650 -subj "/CN=my Key Exchange Key/" -out KEK.crt
> # Convert PEM certificate into DER certificate
$ openssl x509 -outform DER -in KEK.crt -out KEK.cer
> # Convert PEM certificate into EFI signature list
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" KEK.crt KEK.esl
> # Sign EFI signature list containing KEK certificates with PK
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k PK.key -c PK.crt KEK KEK.esl KEK.auth
```

#### Generate db Key
```bash-session
> # Generate KEK using OpenSSL
$ openssl req -newkey rsa:4096 -nodes -keyout db.key -new -x509 -sha256 -days 3650 -subj "/CN=my Signature Database key/" -out db.crt
> # Convert PEM certificate into DER certificate
$ openssl x509 -outform DER -in db.crt -out db.cer
> # Convert PEM certificate into EFI signature list
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" db.crt db.esl
> # Sign EFI signature list containing db certificates with KEK
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db db.esl db.auth
```

### Updating Certificates
To update certificates under user mode, **the change should be signed**. Here we use updating db certificates as an example:

```bash-session
> # Conver db certificate into EFI signature list
$ cert-to-efi-sig-list -g "$(cat GUID.txt)" new_db.crt new_db.esl
> # Sign EFI signature list containting db certificates with KEK
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db new_db.esl new_db.auth
```

If you want to append certificates instead of replacing existing certificates, sign with option `-a`:

```bash-session
$ sign-efi-sig-list -a -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db new_db.esl new_db.auth
```

### Adding Other Certificates
{{< notice warning >}}
This step is important! Many UEFI firmware is signed by keys from Microsoft or device manufacturers. If you only install your own db certificates and set Secure Boot to enable, **UEFI firmware may not be loaded and the device may brick**.

I encountered this problem. Eventually I recovered by re-flashing BIOS and CMOS clearing.
{{</ notice >}}

#### Adding Certificates From Microsoft
After downloading certificates from Microsoft, we need to convert the certificates to EFI certificate list. Here we use the 2011 version certificates as an example:

{{< notice note >}}
Here we setted GUID to `77fa9abd-0359-4d32-bd60-28f4e78f784b`, this is Microsoft's owner GUID.
{{</ notice >}}

```bash-session
$ cert-to-efi-sig-list -g 77fa9abd-0359-4d32-bd60-28f4e78f784b MicWinProPCA2011_2011-10-19.crt MS_Win_db.esl
$ cert-to-efi-sig-list -g 77fa9abd-0359-4d32-bd60-28f4e78f784b MicWinProPCA2011_2011-10-19.crt MS_UEFI_db.esl
```

Concate two EFI signature list into one EFI signature list:

```bash-session
$ cat MS_UEFI_db.esl MS_Win_db.esl > MS_db.esl
```

Sign EFI signature list using your own KEK:

```bash-session
$ sign-efi-sig-list -a -g 77fa9abd-0359-4d32-bd60-28f4e78f784b -k KEK.key -c KEK.crt db MS_db.esl add_MS_db.auth
```

To strictly fit requirements of Microsoft UEFI Secure Boot, you can add KEK from Microsoft. Here we use the 2011 version certificates as an example, first convert it to EFI signature list, then sign the EFI signature list using your own PK:

```bash-session
$ cert-to-efi-sig-list -g 77fa9abd-0359-4d32-bd60-28f4e78f784b MicCorKEKCA2011_2011-06-24.crt MS_KEK.esl
$ sign-efi-sig-list -a -g 77fa9abd-0359-4d32-bd60-28f4e78f784b -k PK.key -c PK.crt KEK MS_KEK.esl add_MS_KEK.auth
```

#### Adding Existing Certificates
Do you remember UEFI variables we backed up at the beginning. It contains existing certificates. You can sign the old EFI signature list using your KEK, then add old db certificates:

```bash-session
$ sign-efi-sig-list -a -g -k KEK.key -c KEK.crt db old_db.esl add_MS_db.auth 
```

If backup contains other cerificates, you can also install them like this.

### Sign EFI Binaries
Use following command to sign an EFI binary:

```bash-session
$ sbsign --key db.key --cert db.crt --output file.efi file.efi
```

Use following command to verify an EFI binary:

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