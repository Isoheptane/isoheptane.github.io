+++
title = "在 ZFS 上安装 Arch Linux"
tags = ["Linux", "Arch Linux", "ZFS", "文件系统"]
date = "2023-05-07"
update = "2023-06-21"
enableGitalk = true
+++

### 前言
某日在群里水群时和群友讨论在 Linux 上使用何种文件系统较理想。**BtrFS** 作为 Linux 的新一代文件系统，在各方面都相当出色。但 BtrFS 在出问题之后的维护似乎会很麻烦，容易不小心做出错误的操作。

有群友提出使用 **ZFS** 作为 Linux 的文件系统。ZFS 是 Sun Microsystems 为 Solaris 开发的文件系统。ZFS 也具有 BtrFS 所具有的许多功能，但 ZFS 在许多概念上还要再先进一些。尽管 ZFS 是为 Solaris 开发的文件系统，[OpenZFS](https://github.com/openzfs/zfs) 使得 Linux 和 FreeBSD 上也能够使用 ZFS。

由于许可证不兼容（OpenZFS 使用 CDDL 许可证），因此对 ZFS 的支持无法整合到 Linux 内核中，而只能以内核模块的形式加载。这会让整个安装过程变得更加麻烦……但我并不介意折腾！

本次安装的流程参照 ArchWiki 上的[这篇文章](https://wiki.archlinux.org/title/Install_Arch_Linux_on_ZFS)。此次安装将会使用到 [`Arch ZFS`](https://wiki.archlinux.org/title/Unofficial_user_repositories#archzfs) 这个非官方用户仓库。

## ZFS 的一些基本概念

> *你说的对，但 ZFS 是一款由 Sun Microsystems 自主研发的一款全新卷系统管理器和文件系统。文件系统运行在一个被称作「Linux」的幻想世界，在这里，被 root 选中的存储池将被授予「lz4」，导引存储之力。你将扮演一位名为「系统管理员」的神秘角色，在自由的 zpool create 中邂逅功能各异、feature 独特的 vdevs 们，和他们一起「state: DEGRADED」，找回失散的数据集——同时，逐步发掘 「BtrFS」 的真相……*

### vdev
vdev (Virutal Device) 是**组成存储池的基本单位**。vdev 可以由**一个或多个的硬盘、分区或文件**组成（在实际应用中强烈不推荐使用文件）由多个硬盘、分区或文件组成的 vdev 可以像阵列一样设置 RAID 类型。ZFS 中的 vdev 支持条带化 (RAID 0)、镜像 (RAID 1) 和 ZFS 提供的阵列类型 RAID Z1/Z2/Z3 等。也就是说，一个 vdev **通常**可以看作一是一个硬盘或一个阵列。

### 存储池 (Pool)
存储池可以视作一个**存储管理器**，也可以简单地视作一个大的存储设备。存储池也可以由**一个或多个的 vdev** 组成。存储池中的 vdev 可以用于存储数据、作为读/写缓存或作为冗余盘组。一个存储池中可以拥有多个用于存储数据的 vdev，但需要注意的是，这些 vdev 之间以类似 **RAID 0** 的方式组织。

### 数据集 (Dataset)
如果把存储池视作硬盘（准确来讲是文件系统），那么数据集就可以视作其中的文件夹。数据集也可以设置多种属性，如压缩或加密，还可以设置挂载点以挂载到特定的目录上。数据集的大小是非固定的，其大小将会随着所存储数据的大小变化。数据集的这些特性使得数据集可以用于分类不同的数据。

## 在 ZFS 上安装 Arch Linux
### 在 ArchISO 上加载 ZFS 模块
想要在 ZFS 上安装 Arch Linux，需要先在 ArchISO 环境下创建一个存储池。然而 ArchISO 显然**并不会**集成 ZFS 的支持，因此我们需要先在 ArchISO 上获取并加载 ZFS 模块。[`eoli3n/archiso-zfs`](https://github.com/eoli3n/archiso-zfs) 这个项目提供了一个用于在 ArchISO 环境下安装 ZFS 模块的脚本。这个脚本将会获取当前运行的 ArchISO 的内核版本，并尝试在 [`archzfs`](https://wiki.archlinux.org/title/Unofficial_user_repositories#archzfs) 仓库中寻找匹配的 ZFS 模块。如果没有找到匹配的模块，脚本将会使用 DKMS 来从源代码编译一个 ZFS 模块。

### 硬盘分区
硬盘的分区很大程度上与启动方式有关。在这里以使用 UEFI 启动和 GPT 分区表，并且使用 GRUB 作为 Bootloader 为例。

我们将会把硬盘分为三个区：
- EFI 系统分区 *(存储 EFI 引导程序)*
- Boot 分区 *(存储 Linux 内核和 initrd)*
- Arch Linux 系统分区 *(我们将会在这里创建 ZFS 存储池)*

需要注意的是，包含 ZFS 文件系统的分区的类型应该被设置为 Solaris Root (`bf00`)。

{{< notice warning >}}
ZFS **不支持**使用 Swap file。ZFS 可以创建 Swap 卷作为 Swap 分区，但并不支持从休眠状态下恢复，并且在高内存压力下可能导致系统锁死。参见 [ArchWiki](https://wiki.archlinux.org/title/ZFS#Swap_volume)。如果有使用 Swap 的需求，个人推荐使用单独的 Swap 分区。
{{</ notice >}}

然后就可以先在 EFI 系统分区和 Boot 分区上创建文件系统，**别忘了将设备名称替换为你自己的设备名称**。
```shell
$ mkfs.fat /dev/<esp-partition>
$ mkfs.ext4 /dev/<boot-partition>
```

### 配置 ZFS 文件系统
#### 创建存储池
使用如下的命令来创建一个存储池。若设备的物理扇区大小为 4096 字节，则应设置 `ashift=12`；若设备的物理扇区大小为 512 字节，则应设置 `ashift=9`。
```shell
$ zpool create -f -o ashift=12         \
             -O acltype=posixacl       \
             -O relatime=on            \
             -O xattr=sa               \
             -O dnodesize=legacy       \
             -O normalization=formD    \
             -O mountpoint=none        \
             -O canmount=off           \
             -O devices=off            \
             -R /mnt                   \
             zroot /dev/disk/by-id/id-to-partition-partx
```
在这个存储池中的数据集也会继承存储池的一部分属性。

#### 创建数据集
创建数据集可以将系统和用户数据分离开，这样可以单独为系统创建快照。在有需要时可以从指定的快照启动系统，但本文不会涉及如何配置从快照启动。

首先创建系统和用户数据的数据集。
```shell
$ zfs create -o mountpoint=none zroot/data
$ zfs create -o mountpoint=none zroot/ROOT
$ zfs create -o mountpoint=/ -o canmount=noauto zroot/ROOT/default
$ zfs create -o mountpoint=/home zroot/data/home
```
`zroot/ROOT` 将会用于存储所有的系统快照，而 `zroot/ROOT/default` 则是默认系统的数据集。

对于某些系统目录，还需要设置 `canmount=off`。
```shell
$ zfs create -o mountpoint=/var -o canmount=off     zroot/var
$ zfs create                                        zroot/var/log
$ zfs create -o mountpoint=/var/lib -o canmount=off zroot/var/lib
$ zfs create                                        zroot/var/lib/libvirt
$ zfs create                                        zroot/var/lib/docker
```

{{< notice tip >}}
你们也许会注意到，在这里我们创建了一个挂载点为 `/var` 的数据集 `zroot/var`，但是却将其设置为不可挂载。

推测创建这样的一个数据集的目的是**继承挂载点属性**。`mountpoint` 属性是**可继承**的，而 `canmount` 属性是**不可继承**的。因此，尽管数据集 `zroot/var` 无法挂载，但数据集 `zroot/var/log` 却是可以挂载的，并且将会挂载到 `/var/log`。

在此情况下，存储在 `/var` 中的其它文件将会存储在 `zroot/ROOT/default` 中，而存储在 `/var/log` 中的文件将会存储在 `zroot/var/log` 中。
{{</ notice >}}

#### 导出/导入存储池
为了确保我们的配置没有问题，我们需要先导出存储池并重新导入存储池。
```shell
$ zpool export zroot
$ zpool import -d /dev/disk/by-id -R /mnt zroot -N
```
然后挂载所有数据集。
```shell
$ zfs mount zroot/ROOT/default
$ zfs mount -a
```

#### 复制 zpool.cache
`/etc/zfs/zpool.cache` 会存储已经导入的存储池的配置信息。当导入一个存储池的时候，这个存储池的信息也会被添加到 `zpool.cache` 当中。对于已经导入过的存储池，需要再次导入时直接执行指令 `zfs import` 即可。否则需要使用 `zfs import -d /dev/disk/by-id` 来导入。

将 `zpool.cache` 复制到我们要安装的系统当中，这个文件在启动过程中是需要的。
```shell
$ cp /etc/zfs/zpool.cache /mnt/etc/zfs/zpool.cache
```
如果 `zpool.cache` 不存在的话，那就用这个指令创建。
```shell
$ zpool set cachefile=/etc/zfs/zpool.cache zroot
```
### 安装 Arch Linux 
首先，你还需要手动挂载 EFI 系统分区和 Boot 分区，并生成 `fstab`。
```shell
$ mount --mkdir /dev/esp-partition /mnt/efi
$ mount --mkdir /dev/boot-partition /mnt/boot
$ genfstab -U -p /mnt >> /mnt/etc/fstab
```
然后安装 Arch Linux。
```shell
$ pacstrap -K /mnt base linux linux-firmware ...
```
接下来 chroot 进入安装好的新系统中。
```shell
$ arch-chroot /mnt
```

### 安装 ZFS
此时的新系统中还没有安装 ZFS 的支持，所生成的 initrd 中自然也不包含对 ZFS 的支持。此时如果重新启动，是无法挂载根文件系统。我们要先安对 ZFS 的支持，首先需要将 [`Arch ZFS`](https://wiki.archlinux.org/title/Unofficial_user_repositories#archzfs) 仓库添加到 `/etc/pacman.conf` 中。然后安装 `zfs` 包。

在安装好 `zfs` 之后，你还需要修改 `mkinitcpio` 的配置文件，确保 ZFS 模块能够被集成到 initrd 中。请修改 hooks，将 `zfs` 添加到 `filesystems` 之前，并且把 `keyboard` 也移动到 `zfs` 之前。
```shell
HOOKS=(base udev autodetect modconf block keyboard zfs filesystems ...)
```

#### 关于 ZFS 包的选择
有多个包可以提供 ZFS 支持，它们适配不同版本的 Linux 内核。例如 [`zfs-linux`](https://aur.archlinux.org/packages/zfs-linux) 适配 [`linux`](https://archlinux.org/packages/?name=linux)、[`zfs-linux-lts`](https://aur.archlinux.org/packages/zfs-linux-lts) 适配 [`linux-lts`](https://archlinux.org/packages/?name=linux-lts)。然而 Arch ZFS 的更新通常会比内核的更新要慢一截，因此在内核版本更新时，Arch ZFS 中的包可能无法及时跟上内核的版本而导致内核无法更新。[`zfs-dkms`](https://aur.archlinux.org/packages/zfs-dkms) 可以通过从源代码编译 ZFS 模块来适配更多的内核版本，但当内核出现大版本更新时，也可能会跟不上内核版本。

个人推荐使用 `zfs-dkms`，但请务必注意在每次更新 `zfs-dkms` 或 `linux` 包之后使用 `mkinitcpio` 重新创建 initrd。你可以通过 pacman hook 来实现更新后重新创建 initrd。

创建 `/etc/pacman.d/hook/90-mkinitcpio-dkms-linux.hook`：
```ini
[Trigger]
Operation=Install
Operation=Upgrade
Operation=Remove
Type=Package
Target=zfs-dkms
Target=linux

[Action]
Description=Update Linux init cpio after dkms module update.
Depends=mkinitcpio
When=PostTransaction
NeedsTargets
Exec=/bin/sh -c 'while read -r trg; do case $trg in linux) exit 0; esac; done; /usr/bin/mkinitcpio -p linux'i
```

#### 遇到的麻烦
大约是半个月前，当时我正在试图把 Arch Linux 装到 ZFS 上（也就是本篇文章介绍的内容）。

刚刚安装好的时候一切顺利，内核版本为 `6.2.11-arch1-1`，而 `zfs-linux` 正好也支持这个版本。然后我 `pacman -Syu` 了一下，发现上游内核更新到了 `6.2.12-arch1-1`，但 `zfs-linux` 还没有更新。依赖关系无法满足，因此无法执行系统更新。

于是我就换用了 `zfs-dkms`，然后执行系统更新。一切看起来都没什么问题，直到我某次重启过后喜提一个 Kernel Panic。我似乎忘了更新 initrd，dkms 编译好的 ZFS 模块实际上并没有被整合到 initrd 中。

于是我就不得不再进入 ArchISO 环境，安装 ZFS，然后把系统分区挂载上，再 chroot 进去用 `mkinitcpio` 重新构建 initrd。为了避免再次出现这样的情况，我添加了一个 hook 来让 dkms 模块或内核更新时自动重新构建 initrd.

#### 更多的麻烦
在我写这篇文章的前一天，我也 `pacman -Syu` 了一下，到最后 `mkinitcpio` 的时候报错 module not found。

我心想可能是 `zfs-dkms` 的编译出了问题，于是我就试着重新编译了一下 `zfs-dkms`。结果发现 `linux` 内核已经更新到了 `6.3.1-arch1-1`，但 `zfs-dkms` 最高也只支持到 `6.2`，这下就只能降级内核版本了：
```shell
$ pacman -U /var/cache/pacman/pkg/linux-6.2.12.arch1-1-x86_64.pkg.tar.zst /var/cache/pacman/pkg/linux-headers-6.2.12.arch1-1-x86_64.pkg.tar.zst
```

### 安装 Bootloader
在确保安装了 `grub` 包之后，使用如下的指令将 GRUB 安装到 EFI 系统分区上：
```shell
$ grub-install --target=x86_64-efi --efi-directory=/efi --bootloader-id=GRUB
```
然后生成 GRUB 的配置文件：
```shell
$ grub-mkconfig -o /efi/grub/grub.cfg
```

### 配置 ZFS 的自动导入和挂载
为了在启动时导入存储池，需要启动以下的服务：
- `zfs.target`
- `zfs-import.target`
- `zfs-import-cache.service`

如果你想要让指定的存储池在启动时自动导入，使用如下的指令：
```shell
$ zpool set cachefile=/etc/zfs/zpool.cache <pool-name>
```

而挂载则有两种选择：
- 启动服务 `zfs-mount.service`
- 使用 zfs-mount-generator

如果先前配置了将数据集挂载到某些系统目录（例如 `/var`）上，则需要使用 zfs-mount-generator。

#### 使用 zfs-mount-generator
首先需要首先创建目录 `/etc/zfs/zfs-list.cache`，并启动 ZFS Evene Daemon (ZED) 服务 (`zfs-zed.service`)。

对于你想要自动挂载数据集的存储池，你需要创建一个空文件：
```shell
$ touch /etc/zfs/zfs-list.cache/<pool-name>
```

然后修改任意 ZFS 文件系统的属性，ZED 会捕捉到这样的修改，并更新在目录 `/etc/zfs/zfs-list.cache` 中的文件。
```shell
$ zfs set canmount=off zroot/anyDataset
$ zfs set canmount=on zroot/anyDataset
```

#### 设置 hostid
ZFS 使用 hostid 来追踪存储池是在哪个设备上使用的。在挂载根文件系统的时候，hostid 是不可用的。我们可以将 hostid 写入内核启动参数中，或者将 hostid 写入 `/etc/hostid` 中，`/etc/hostid` 中记录的 hostid 将会在生成 initrd 时被写入 initrd 中。用下面的命令可以生成一个 hostid 并写入 `/etc/hostid` 中。
```shell
$ zgenhostid $(hostid)
```
当然，写入完成后别忘了用 `mkinitcpio` 重新生成 initrd。

### 导出存储池
退出 chroot 环境，首先取消挂载 EFI 系统分区和 Boot 分区：
```shell
$ umount /mnt/efi
$ umount /mnt/boot
```
接下来取消挂载所有数据集并导出存储池：
```shell
$ zfs umount -a
$ zpool export zroot
```

{{< notice warning >}}
如果存储池没有被正确导出，存储池记录的 hostid （即 ArchISO 环境中的 hostid）就不会被清除。当新系统尝试启动时，新系统的 hostid 与存储池记录的 hostid 不一致，ZFS 会拒绝导入存储池。
{{</ notice >}}

最后重启设备，安装流程就结束了。

## 结语
中间遇到的各种小麻烦和做错的地方也不少，所以为此我甚至通宵了一个晚上呢。虽然说很疲倦，不过总之是学到很多。

- - -
### 参考资料
- [ZFS - ArchWiki](https://wiki.archlinux.org/title/ZFS)
- [Install Arch Linux on ZFS - ArchWiki](https://wiki.archlinux.org/title/Install_Arch_Linux_on_ZFS#Create_the_root_zpool)
- [OpenZFS Documentation](https://openzfs.github.io/openzfs-docs/man/index.html)