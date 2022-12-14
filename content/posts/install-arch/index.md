+++
title = "第一次尝试安装 Arch Linux"
tags = ["Linux"]
date = "2021-10-13"
update = "2021-10-16"
enableGitalk = true
+++

## 为什么突然想装 Arch Linux
想起自己有过一段时间没有折腾过 Linux 相关的东西了，这段时间正好想起上次在虚拟机里安装 Arch Linux 失败的经历，恰巧我笔电刚拿回来。但我笔电上安装的是 Windows 11，并且是一个相对较老的 Beta 渠道体验版。所以今天就试着在实体机上安装了一下 Arch Linux。

我目前正在使用的笔电是 ThinkPad E14 Gen2 (AMD)。

## 安装 Arch Linux
{{< notice note >}}
这并不是一篇完整的教程，而是一篇记录。因此，如果要遵循这篇文章的操作，请根据自己的实际情况适当修改。
阅读本文章前建议先阅读[官方教程](https://wiki.archlinux.org/title/Installation_guide)。
{{< /notice >}}
### 从U盘启动
写入镜像的话，用 Rufus 向U盘中写入镜像就好了，我选择的 MBR 分区表和 ISO 镜像模式。

比较坑的一点是，大部分的笔记本电脑，Secure Boot 都是默认启用的。然而如果要从U盘镜像启动，就必须得把 Secure Boot 关掉。其实我一开始也想到了这一点，但是我看到 BIOS 里那么多的启动项，怀疑其他启动项可能干扰了启动过程（前面的启动项启动失败后便会继续执行后面的启动项），就把硬盘擦除了。事实证明这和启动失败一点关系都没有，也不会删除那些启动项。

在关掉了 Secure Boot 之后，就可以从U盘启动 Archiso 了。

### 硬盘分区
联网貌似是自动的，使用 DHCP 获取到了IP地址。所以这部分就没怎么做过（虽然之后还是得做）。

我几乎没用过 `fdisk` 这种分区工具，所以我也是现学现用~~用完就忘~~的。按照 Arch Linux 官方的教程，UEFI 模式下应该分出三个分区，分别是 ESP 分区、交换分区和根文件系统分区。ESP 分区我设置了 512MB 的大小，交换分区为 12GB，根文件系统占用其他所有空间。

```shell
Device            Start       End   Sectors  Size Type
/dev/nvme0n1p1     2048   1048576   1048576  512M EFI System
/dev/nvme0n1p2  1050624  25165824  25165824   12G Linux swap
/dev/nvme0n1p3 26216448 500118158 473901711  226G Linux filesystem
```

然后我们在分区上创建文件系统。把根文件系统的分区挂载到 `/mnt` 上，把 ESP 分区挂载到 `/mnt/efi` 上，并开启 swap 分区。

```shell
# 创建文件系统
$ mkfs.fat -F32 /dev/nvme0n1p1
$ mkswap /dev/nvme0n1p2
$ mkfs.ext4 /dev/nvme0n1p3
# 挂载分区
$ mount /dev/nvme0n1p3 /mnt
$ mount /dev/nvme0n1p1 /mnt/efi
# 在 swap 分区上开启 swap
$ swapon /dev/nvme0n1p2
```

### 安装 Boot loader
到这一步就可以开始安装了，其实整体上跟着 ArchWiki 上的走就差不多。
```shell
# 在 /mnt 下安装必要的包
# 其实这里还建议安装 dhcpcd 和 base-devel 之类的其他包
# 不过我安装的时候没有装上，所以后面会比较麻烦
$ pacstrap /mnt base linux linux-firmware
# 生成 fstab
$ genfstab -U /mnt >> /mnt/etc/fstab
# chroot 进系统里
$ arch-chroot /mnt
```
跟着流程的设置自然不用多说，跟着 ArchWiki 走就好了，现在安装 Boot loader。在 UEFI 下，安装 `grub` 需要安装两个包：`grub` 和 `efibootmgr`。用 `pacman` 把它们安装上就好了。接下来执行：

```shell
$ grub-install --target=x86_64-efi --efi-directory=/efi --bootloader-id=GRUB
```

最后需要生成 grub 的配置文件，照着  这上面的来就可以了~~别像我一样第一次把配置文件生成到了 `/efi/grub/` 里。~~ 然后用 `exit` 退出 chroot 环境后，就可以 `reboot` 重启了。重启后应该会看到 `grub` 选择启动项的页面。

```shell
$ grub-mkconfig -o /boot/grub/grub.cfg
```

## 安装后的一些工作
### 创建一个普通用户
首先要做的事情就是创建一个普通用户。

日常使用时用 `root` 用户是非常危险的，如不小心打出了 `rm -rf /*` 这样的操作。所以日常使用还是有必要创建一个新的用户的，我们用如下指令创建一个新用户 `iso` 并将这个用户加入到 `wheel` 这个用户组里。

```shell
$ useradd -m -G wheel iso
```

然后用 `passwd iso` 给这个用户设置一个密码。
使用 `sudo` 指令需要先安装 `sudo` 这个包，用 `pacman -S sudo` 安装上就好了。接下来我们需要修改 sudoers 列表，让在 `wheel` 组中的成员可以使用 `sudo` 指令。这里我们需要用到 `visudo` 这个专用的指令打开 `vi` 来修改 sudoers 列表。不过由于 `vi` 并不是预装的，所以我们这里还需要创建一个 `vi` 到 `vim` 的软链接。

```shell
$ ln -s /usr/bin/vi /usr/bin/vim
$ visudo
```

找到下面这一行，去掉注释，然后重启即可。

```shell
# %wheel ALL=(ALL) ALL
```

### 安装 KDE
以前用 Manjaro 的时候就用的 KDE，所以在这里我也安装 KDE 好了。首先需要安装显卡驱动，因为我是 AMD 核显用户，所以我就直接安装 `xf86-video-amdgpu` 了。（其他的显卡可以参考这张图）
{{< image driver-selection.webp >}}
然后我们安装 Xorg 和桌面环境，并启动桌面管理器：

```shell
# 安装 Xorg
$ sudo pacman -S xorg
# 安装 Plasma 桌面环境
$ sudo pacman -S plasma
# 安装并启动桌面管理器服务，用于帮助我们进入桌面环境
$ sudo pacman -S sddm
$ sudo systemctl enable sddm
# 关闭之前使用的网络服务，使用桌面环境下使用的 NetworkManager 服务
# netctl 有可能并没有开启
$ sudo systemctl disable netctl
$ sudo systemctl enable NetworkManager
# 安装工具栏工具
$ sudo pacman -S network-manager-applet

# 如果你想要的话，你也可以安装上 KDE 的预装应用，不过体积很大，而且有可能你用不到
$ sudo pacman -S kde-applications
```

这样桌面环境就安装完成了，重启应该就能进入桌面了。

### 配置 ArchlinuxCN 仓库和 AUR

> Arch Linux 中文社区仓库 是由 Arch Linux 中文社区驱动的非官方用户仓库。包含中文用户常用软件、工具、字体/美化包等。

> Arch 用户软件仓库（Arch User Repository，AUR）是为用户而建、由用户主导的 Arch 软件仓库。AUR 中的软件包以软件包生成脚本（PKGBUILD）的形式提供，用户自己通过 makepkg 生成包，再由 pacman 安装。创建 AUR 的初衷是方便用户维护和分享新软件包，并由官方定期从中挑选软件包进入 community 仓库。  

有很多包是来自 [ArchlinuxCN](https://www.archlinuxcn.org/) 仓库和 [AUR](https://aur.archlinux.org/) 的，首先需要配置好 ArchlinuxCN 仓库。打开 `/etc/pacman.conf` 并在文件末尾添加上这两行：

```pacmanconf
[archlinuxcn]
Server = https://repo.archlinuxcn.org/$arch
```

也可以使用镜像站，比如[清华大学开源软件镜像站](https://mirrors.tuna.tsinghua.edu.cn/)提供的 ArchlinuxCN 镜像：

```pacmanconf
Server = https://mirrors.tuna.tsinghua.edu.cn/archlinuxcn/$arch
```

Server = https://mirrors.tuna.tsinghua.edu.cn/archlinuxcn/$arch

然后同步包列表，安装 key-ring 和 `yay` (Yet another yaourt)，因为我在 Manjaro 下常用的就是 `yay`。

```shell
sudo pacman -Syu
sudo pacman -S archlinuxcn-keyring
sudo pacman -S yay
```

`yay` 是一个 AUR 助手，可以用来管理 AUR 上包。同样，AUR 也是有镜像的，可以通过下面的命令修改到清华大学开源软件镜像站。

```shell
$ yay --aururl "https://aur.tuna.tsinghua.edu.cn" --save
```

## 开始使用

到了这里，系统差不多就“能用”了。之后就是安装一些常用的东西，去下载主题什么的了。当然后续还需要更多的调教什么的，不过那就不在“安装”的范畴之内了。

- - -

### 参考资料
- [Arch Linux Installation Guide](https://wiki.archlinux.org/title/Installation_guide)
- [Arch Linux GRUB](https://wiki.archlinux.org/title/GRUB)
- [以官方Wiki的方式安装ArchLinux](https://www.viseator.com/2017/05/17/arch_install/)
- [ArchLinux安装后的必须配置与图形界面安装教程](https://www.viseator.com/2017/05/19/arch_setup/)