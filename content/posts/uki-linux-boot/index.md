+++
name = "uki-linux-boot"
title = "使用统一内核映像 (UKI) 引导 Linux"
tags = ["Linux", "UEFI"]
date = "2023-06-21"
update = "2023-06-24"
enableGitalk = true
+++

### 前言
我原本使用 [GRUB](https://wiki.archlinuxcn.org/wiki/GRUB) 作为 Bootloader，但 GRUB 让我感觉不太舒服。UEFI 固件可以直接引导可执行 EFI 文件，并不一定需要中间的 Bootloader 来引导操作系统。此外，GRUB 总是会在启动前显示引导选项菜单，而我并没有心思去美化这个菜单。

让 UEFI 固件不经过中间 Bootloader 引导 Linux 似乎是可行的，因此我决定不再使用 GRUB，而是选择让 UEFI 固件直接引导 Linux 内核映像。

## 不同的引导方式
### 通过 GRUB 引导
在 BIOS 平台上，如果使用[**主引导记录 (MBR)**](https://zh.wikipedia.org/zh-cn/%E4%B8%BB%E5%BC%95%E5%AF%BC%E8%AE%B0%E5%BD%95) 分区表，在创建分区时往往会在 MBR 与第一个分区之间留出 1~2MB 的空间，这被称之为 **MBR 后间隙**。在安装时，安装程序会将 GRUB 嵌入到 MBR 后间隙中，并重写 MBR，使 MBR 中的引导代码可以启动 MBR 后间隙中的 GRUB。在启动时，BIOS 会先执行 MBR 中的引导代码，随后这段引导代码将会加载并启动 GRUB。

如果使用 [**GUID 分区表 (GPT)**](https://zh.wikipedia.org/zh-cn/GUID%E7%A3%81%E7%A2%9F%E5%88%86%E5%89%B2%E8%A1%A8)，GRUB 则需要被安装到指定的 **BIOS 启动分区**中。在启动时 BIOS 将会从 BIOS 启动分区加载并启动 GRUB。

在 UEFI 平台上，GRUB 呈现为一个**可执行 EFI 文件**。GRUB 通常会被安装到 EFI 系统分区中，作为一个可执行 EFI 文件存在。在安装时，安装程序也会向 UEFI 引导序列中加入一个 GRUB 的引导选项。在 UEFI 固件中选择启动 GRUB 后，UEFI 固件将会从 EFI 系统分区加载并启动 GRUB。

在 GRUB 启动后，GRUB 会根据其配置文件呈现启动项。GRUB 可以读取 ext4 和 BtrFS 分区，因此可以将 Linux 内核与 initramfs 存储在 Linux 根分区中（往往会存储在 `/boot` 中）。当选择启动 Linux 时，GRUB 将会将 Linux 内核 (`vmlinux`/`vmlinuz`) 与 initramfs 加载到内存中，然后启动 Linux。

### EFISTUB 引导
在编译 Linux 内核时设置 `CONFIG_EFI_STUB=y` 即可启用 [EFISTUB 引导](https://wiki.archlinux.org/title/EFISTUB)，Arch Linux 的内核默认启用了 EFISTUB 引导。启用了 EFISTUB 引导的 Linux 内核映像包含一段被称之为 [UEFI Boot Stub](https://docs.kernel.org/admin-guide/efi-stub.html) 的代码，它会在 Linux 内核映像被 UEFI 固件引导后首先执行。UEFI Boot Stub 会对已加载的内核映像进行修改，以确保 Linux 内核能够被启动，然后启动 Linux 内核。

UEFI Boot Stub 所做的工作类似于 Bootloader，所以在某种意义上它就是一个 Bootloader。

UEFI 引导序列可以使用 `efibootmgr` 等工具修改。添加了 Linux 内核映像的引导选项后，在 UEFI 固件中选择启动 Linux 时，UEFI 固件将会引导 Linux 内核映像。

## 统一内核映像 (UKI)
Linux 内核和 Linux 引导过程中需要用到的资源可以被制作成一个可以被 UEFI 固件直接执行的**可执行 EFI 文件**，这个 EFI 文件就是一个[**统一内核映像 (Unified Kernel Image)**](https://wiki.archlinux.org/title/Unified_kernel_image)，简称 **UKI**。一个 UKI 可以包含：
- UEFI Boot Stub，如 [systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html)
- [Linux 内核映像]()
- [initramfs 映像](https://wiki.archlinuxcn.org/wiki/Arch_%E7%9A%84%E5%90%AF%E5%8A%A8%E6%B5%81%E7%A8%8B#initramfs)
- [内核参数](https://wiki.archlinuxcn.org/wiki/%E5%86%85%E6%A0%B8%E5%8F%82%E6%95%B0)
- [CPU 微码](https://wiki.archlinuxcn.org/wiki/%E5%BE%AE%E7%A0%81)
- 启动屏幕

相比于 EFISTUB，UKI 可以整合 initramfs 和 CPU 微码等在引导过程中会使用到的资源。这使得 UKI 相比于支持 EFISTUB 引导的 Linux 内核映像集成度更高，也更容易使用，不需要太多配置即可被 UEFI 固件引导。

### UKI 的结构
UKI 是一个**可执行 EFI 文件**，而 EFI 文件也是一个 **PE/COFF 文件**。以我的系统上正在使用的 UKI 为例，其 PE 区段列表如下：

```plain
Sections:
Idx Name          Size      VMA               LMA               File off  Algn
  0 .text         00009930  0000000000003000  0000000000003000  00000400  2**4
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
  1 .reloc        0000000c  000000000000d000  000000000000d000  00009e00  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  2 .data         00002008  000000000000e000  000000000000e000  0000a000  2**4
                  CONTENTS, ALLOC, LOAD, DATA
  3 .dynamic      00000100  0000000000011000  0000000000011000  0000c200  2**2
                  CONTENTS, ALLOC, LOAD, DATA
  4 .rela         000004f8  0000000000012000  0000000000012000  0000c400  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  5 .dynsym       00000018  0000000000013000  0000000000013000  0000ca00  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  6 .sbat         000000ea  0000000000015000  0000000000015000  0000cc00  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  7 .sdmagic      00000030  0000000000015100  0000000000015100  0000ce00  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  8 .osrel        0000017b  0000000000015200  0000000000015200  0000d000  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  9 .uname        0000000c  0000000000015400  0000000000015400  0000d200  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
 10 .splash       0005c572  0000000000015600  0000000000015600  0000d400  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
 11 .linux        00ab0b18  0000000000071c00  0000000000071c00  00069a00  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
 12 .initrd       0638eac7  0000000000b22800  0000000000b22800  00b1a600  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
```

其中：
- `.linux` 包含 Linux 内核映像
- `.initrd` 包含 initramfs 和 CPU 微码
- `.splash` 包含启动屏幕图片

还有一些在我的 UKI 中未使用的区段，例如 `.cmdline`，其包含嵌入的内核参数。

### systemd-stub 与 UKI 创建
与 EFISTUB 引导中的 UEFI Boot Stub 一样，[systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html) 也实现了类似的功能——即在 UKI 被引导后首先执行，加载 Linux 内核与相关资源，然后启动 Linux 内核。systemd-stub 提供了**仅包含 UEFI Boot Stub 部分的可执行 EFI 文件**，它们可以作为空白模板使用。

在 UKI 被引导后，systemd-stub 会从 UKI 中加载 Linux 内核和所需的资源，如在 `.linux` 区段中寻找 ELF 格式的 Linux 内核、从 `.initrd` 区段加载 initramfs 和 CPU 微码、从 `.cmdline` 区段加载嵌入的内核参数等。所以可以通过**向空白模板中加入更多的 PE 区段来制作一个 UKI**。

[mkinitcpio](https://wiki.archlinux.org/title/Mkinitcpio) 和 [dracut](https://wiki.archlinux.org/title/Dracut) 等工具不仅可以用于创建 initramfs，也可以用于创建 UKI。下面将会介绍使用 mkinitcpio 创建 UKI 的操作。

## 使用 mkinitcpio 创建 UKI
在创建 UKI 之前，需要先设置内核参数并修改 mkinitcpio 的预设配置。

### 嵌入内核参数
首先需要在 UKI 中嵌入你想要使用的内核参数，创建 `/etc/kernel/cmdline` 并写入内核参数。下面是一个例子：

```plain
root=UUID=b9fb5b31-07f1-408c-9447-10a1b2476b4d rw splash loglevel=3
```

在创建 initramfs 时，mkinitcpio 会读取其中的内容并将其作为内核参数将其嵌入 UKI 中。

{{< notice note >}}
你也可以选择在 UEFI 引导选项中添加想要使用的内核参数。但请注意，如果启用了 Secure Boot 且 UKI 中嵌入了内核参数（即存在 `.cmdline` 区段），内核将会**只使用嵌入的内核参数**，并忽略从外部传递的额外参数。详见 [systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html)。
{{</ notice >}}

### 修改 mkinitcpio 预设
[mkinitcpio](https://wiki.archlinux.org/title/mkinitcpio) 可以创建 UKI，但在此之前需要对 mkinitcpio 的预设进行一些修改。修改 `/etc/mkinitcpio.d/linux.preset`：
- 取消对 `PRESET_uki=...` 的注释来启用 UKI 创建，并指定 UKI 的保存位置
- 注释 `PRESET_image` 来关闭 initramfs 映像创建

UKI 通常应该被保存到 EFI 系统分区中。以使用 `linux` 内核的 Arch Linux、EFI 系统分区挂载到 `/efi` 为例，修改完成后的 `linux.preset` 看起来应该像这样：

```shell
ALL_config="/etc/mkinitcpio.conf"
ALL_kver="/boot/vmlinuz-linux"
ALL_microcode=(/boot/*-ucode.img)

PRESETS=('default' 'fallback')

#default_config="/etc/mkinitcpio.conf"
#default_image="/boot/initramfs-linux.img"
default_uki="/efi/EFI/Linux/arch-linux.efi"
#default_options="--splash /usr/share/systemd/bootctl/splash-arch.bmp"

#fallback_config="/etc/mkinitcpio.conf"
#fallback_image="/boot/initramfs-linux-fallback.img"
fallback_uki="/efi/EFI/Linux/arch-linux-fallback.efi"
fallback_options="-S autodetect"
```

{{< notice tip >}}
- 如果要将启动屏幕图片整合进 UKI 当中，只需要取消对 `PRESET_options` 的注释并在其中添加 `--splash /path/to/your/splash_picture.bmp` 即可。
- 如果需要为某一预设单独设置内核参数，在 `PRESET_options` 中添加 `--cmdline /path/to/your/cmdline` 即可。
- 如果选择不使用嵌入的内核参数，在 `PRESET_options` 中添加 `--no-cmdline` 即可。
{{</ notice >}}

接下来就只需要使用 mkinitcpio 来创建 UKI 了。

```bash-session
$ mkdir -p /efi/EFI/Linux
$ mkinitcpio -p linux
```

## 引导 UKI

{{< notice warning >}}
由于在这里并没有对 UKI 进行签名，因此如果启动了 Secure Boot，UEFI 固件将会拒绝引导 UKI。如果要引导未签名的 UKI，请确保 Secure Boot 处于关闭状态。
{{</ notice >}}

### 使用 UEFI 引导选项
在这里以使用 [efibootmgr](https://github.com/rhboot/efibootmgr) 为例，向 UEFI 引导序列中添加一个引导选项：

```bash-session
$ efibootmgr --create \
    -d /dev/sdX -p Y \
    --label "Arch Linux" \
    --loader "EFI/Linux/arch-linux.efi"
```

其中 `sdX` 为 EFI 系统分区所在的设备名称，`Y` 为 EFI 系统分区的分区编号，`--loader` 指定了要引导的 UKI 在分区中的位置。

如果需要在 UEFI 引导选项中指定内核参数，使用 `-u parameters` 来指定以 UTF-16 编码的额外参数：

```bash-session
$ efibootmgr --create \
>   -d /dev/sdX -p Y \
>   --label "Arch Linux" \
>   --loader "EFI/Linux/arch-linux.efi" \
>   -u "root=UUID=b9fb5b31-07f1-408c-9447-10a1b2476b4d rw splash loglevel=3"
```

### 使用 UEFI Shell 引导
如果只是想临时地引导一个 UKI 而并不想把它加入引导序列中，又或者是忘记向加入引导序列加入引导选项而无法引导 UKI，可以进入 UEFI Shell 来手动引导 UKI。

在进入 UEFI Shell 后，屏幕上通常会显示可用的文件系统 (FS) 和块设备 (BLK)。如果没有的话，执行 `map` 指令可以显示可用的文件系统和块设备。它们看起来通常是类似于这样的：

```plain
Mapping table
      FS0: Alias(s):HD0b:;BLK1:
        PciRoot(0x0)/Pci(0x1,0x1)/Pci(0x0,0x0)/
        NVMe(0x1,00-11-22-33-44-55-66-77)/
        HD(1,GPT,C9CFBD7E-CF6B-4FBA-BC16-FA9BC170AE5F,0x800,0x180000)
      BLK3: Alias(s):
        PciRoot(0x0)/Pci(0x1,0x1)/Pci(0x0,0x0)/
        NVMe(0x1,00-11-22-33-44-55-66-77)/
        HD(4,GPT,11F19580-6B4A-4D1B-B963-6C434DC14700,0x2180800,0x38205800)
# ...
```

在可用的文件系统中找到 EFI 系统分区，用下面的指令进入 EFI 系统分区并引导 UKI：

```plain
Shell> FS0:
FS0:\> cd EFI\Linux
FS0:\EFI\Linux> arch-linux.efi root=UUID=b9fb5b31-07f1-408c-9447-10a1b2476b4d rw splash loglevel=3
```

在执行最后一条指令后，Linux 应该会正常启动。

## 关于 Secure Boot
如果要使 UKI 能够在启用了 Secure Boot 的平台上被引导，则需要对 UKI 进行签名。大多数设备使用来自微软的证书，这意味着**只有被微软的密钥签名的映像才能够被引导**。同时，这也意味着你必须**用自己的证书替换掉设备原有的证书**才能在启用了 Secure Boot 的情况下引导自己签名的 UKI。

由于配置 Secure Boot 的内容较长，因此我会在另一篇文章中介绍 Secure Boot。

### 结语
原本以为只是很简短的一篇关于如何创建并使用 UKI 的教程，实在没想到最后居然写了这么长。虽然说 objdump 和各种代码展示也占用了不少的篇幅，但整体来讲内容还是较为庞大的。

一开始还以为最终写出来也基本上只是照搬 Wiki，但在撰文的过程中我也在不断地学习，向文章中添加自己的理解。从不同的启动方式到 UKI 的结构、再到创建和引导 UKI，期间查阅各种资料，自己的理解也逐渐变得更深刻了。

- - -
### 参考资料
- [Unified Kernel Image - ArchWiki](https://wiki.archlinux.org/title/Unified_kernel_image)
- [EFISTUB - ArchWiki](https://wiki.archlinux.org/title/EFISTUB)
- [systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html)
- [The EFI Boot Stub - The Linux Kernel Documentation](https://docs.kernel.org/admin-guide/efi-stub.html)
- [GRUB - Arch Linux 中文维基](https://wiki.archlinuxcn.org/wiki/GRUB)
- [分区 - Arch Linux 中文维基](https://wiki.archlinuxcn.org/wiki/%E5%88%86%E5%8C%BA)