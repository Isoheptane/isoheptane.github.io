+++
name = "old-zfs-signature-boot-failure"
title = "残留的 ZFS 文件系统签名引发的 Linux 启动故障"
tags = ["Linux", "ZFS", "udev", "blkid", "文件系统"]
date = "2025-07-08"
update = "2025-07-08"
enableGitalk = true
+++

### 前言
在 bcachefs 于 Linux 6.7 并入主线后，我就很快地将系统迁移到了 bcachefs 上。尽管后来（似乎是因为内存模组故障）而发生了一些严重的文件系统错误导致一些 Library 的文件内容变空，但我最后还是通过重新安装所有软件包修好了，一直用到了现在。

直到两个月前，在一次重启之后，根文件系统的挂载超时了……

### 尝试启动

{{< image src=cant-boot.webp >}}

于是我就被丢进 Emergency Shell 了。

当然，首先要做的就是看看能不能认出根文件系统的分区，于是我用 `blkid` 检查了一下已经识别的分区：

```plaintext
/dev/nvme0n1p1: UUID="8629-150B" BLOCK_SIZE="512" TYPE="vfat" PARTLABEL="EFI_Part" PARTUUID="9a38d8bb-3f5c-5b44-beb6-707df431ec4e"
/dev/nvme1n1p2: LABEL="Windows" BLOCK_SIZE="512" UUID="08F6B9A8F6B99702" TYPE="ntfs" PARTUUID="10b0e52b-dbea-4855-927a-46617ff1b2df"
/dev/nvme1n1p1: UUID="014986a5-c608-4ead-a72c-739a8a89e19d" UUID_SUB="c6bc9643-d474-44c2-811d-20730a2a7962" BLOCK_SIZE="4096" TYPE="btrfs" PARTLABEL="Basic data partition" PARTUUID="66604c58-0bb7-4828-8a6d-bed86c9d7f4a"
```

然而只识别了三个分区，恰好是根文件系统没有被识别出来。但根文件系统用得好好的，不太可能出问题吧……？所以我列出了所有的 nvme 块设备：

```plaintext
[cascade@cascade-ws ~]$ ls -al /dev/nvme*
crw------- 1 root root 237, 0 May 27 04:30 /dev/nvme0
brw-rw---- 1 root disk 259, 0 May 27 04:30 /dev/nvme0n1
brw-rw---- 1 root disk 259, 1 May 27 04:30 /dev/nvme0n1p1
brw-rw---- 1 root disk 259, 2 May 27 04:30 /dev/nvme0n1p2
crw------- 1 root root 237, 1 May 27 04:30 /dev/nvme1
brw-rw---- 1 root disk 259, 3 May 27 04:30 /dev/nvme1n1
brw-rw---- 1 root disk 259, 4 May 27 04:30 /dev/nvme1n1p1
brw-rw---- 1 root disk 259, 5 May 27 04:30 /dev/nvme1n1p2
```

好在 `/dev/nvme0n1p2`，也就是我的根文件系统所在的分区，还是认出来了的，于是我就试了试把它挂载到 `/new_root` 上。

```bash
$ mount.bcachefs /dev/nvme0n1p2 /new_root
```

{{< notice note >}}
Linux 的块设备文件名实际上可能会变动，不过为了在本文中统一含义，本文中**根文件系统**的分区的块设备文件名均为 `/dev/nvme0n1p2`。
{{</ notice >}}

退出 Emergency Shell，系统就正常启动了，这至少可以证明根文件系统是没有损坏的，而且我也还能进系统（这是好事！）。但为什么 blkid 不识别呢？

## 块设备持久化命名和 udev

现在至少是成功启动了 Linux 系统，回到了熟悉的桌面上了。

经过一番在 `/dev/disk` 中的探索，我发现根文件系统所在的分区没有被分配基于 UUID 的持久化命名。不仅如此，PARTUUID 和 LABEL 等也是一概没有的。正因为如此，系统才无法根据 UUID 来从 `/dev/disk/by-uuid/...` 中挂载分区。不过基于设备 ID 的持久化命名是存在的。

由于 PARTUUID 也没有，因此我还检查了一下这块硬盘上的分区表，然而分区表看起来似乎也没有任何问题。

块设备持久化命名是由 **udev** 管理的，因此我观察了一下 udev 对块设备持久化命名的配置文件 `60-persistent-storage.rules`，发现了为块设备分配 UUID 的代码调用了 udev 内建的 blkid，然后再根据 blkid 的结果创建 `/dev/disk/by-uuid/<UUID>` 到实际块设备的符号链接。这里调用 blkid 的这一行为第 133 行：

{{< image src=udev-rule.webp >}}

尽管看起来是 blkid 的问题，但我还是把 udev 的 Debug 信息输出打开了。通过在内核启动参数中添加 `udev.log_level=debug`，可以让 udev 输出调试信息。

重启，进入系统，然后用 `sudo journalctl -b 0 -u systemd-udevd > log.log` 把和 udev 相关的日志保存下来，再用 `grep` 检查日志中和 `/dev/nvme0n1p2` 相关的记录：

```plaintext
$ sudo journalctl -b 0 -u systemd-udevd > log.log
$ grep -e "nvme0n1p2" log.log
...
May 27 04:30:30 cascade-ws (udev-worker)[509]: nvme0n1p2: Failed to probe superblocks: Operation not permitted
May 27 04:30:30 cascade-ws (udev-worker)[509]: nvme0n1p2: /usr/lib/udev/rules.d/60-persistent-storage.rules:133 Failed to run builtin 'blkid': Operation not permitted
...
```

好了，这下可以确定是 blkid 的问题了。这个报错似乎信息是用 `%m` 打印的，因此看起来并不只是 `Operation not permitted` 而已，报错信息似乎没有太大价值。

不过在检查了一下 [udev 的代码](https://github.com/systemd/systemd/blob/741a184a31127305fb4363833ca9d97a1057fc68/src/udev/udev-builtin-blkid.c#L324)之后，我确认了是 udev 确实调用了 blkid。接下来就该看看**为什么 blkid 无法正常识别分区**了。

## libblkid
### blkid 低级探测

我仿照 blkid 的代码，自己也利用 libblkid 写了一个[小的探测程序](./test_blkid.c)，尝试探测了一下根文件系统所在的分区。blkid 完整的过程过程比较复杂，但是我提取出了 blkid 进行低级探测的方法——主要是通过分区表和文件系统的 superblock 来进行探测。

libblkid 中提供了 `blkid_do_safeprobe()` 和 `blkid_do_fullprobe()` 两种探测方式。当使用 `blkid_do_fullprobe()` 时，blkid 可以返回正确的结果：

```plaintext
ISBLK checked
Size is 0
RC = 0
16 values fetched.
 > UUID: efa45a42-33f3-4711-87b4-c63f27f1dd6c
 > BLOCK_SIZE: 512
 > UUID_SUB: fbeecf13-9755-4ac9-9fc8-ba85eb9432b4
 > TYPE: bcachefs
 > MINIMUM_IO_SIZE: 512
 > PHYSICAL_SECTOR_SIZE: 512
 > DISKSEQ: 1
 > LOGICAL_SECTOR_SIZE: 512
 > PART_ENTRY_SCHEME: gpt
 > PART_ENTRY_NAME: Linux_Root
 > PART_ENTRY_UUID: 5b484aa9-94db-4ab3-a2d6-0727effe4af0
 > PART_ENTRY_TYPE: 0fc63daf-8483-4772-8e79-3d69d8477de4
 > PART_ENTRY_NUMBER: 2
 > PART_ENTRY_OFFSET: 1574912
 > PART_ENTRY_SIZE: 975198208
 > PART_ENTRY_DISK: 259:0
```

但 `blkid_do_safeprobe()` 就无法返回结果了：

```plaintext
ISBLK checked
Size is 0
RC = -1
0 values fetched.
```

好嘛，那还是直接去看 libblkid 的代码好了。

### safeprobe 和 fullprobe 的差异

[`blkid_do_safeprobe()`](https://github.com/util-linux/util-linux/blob/49a7b29e9f727dde4e8601f4d2ca2fbc4846258f/libblkid/src/probe.c#L1791) 的代码应当会调用探测 superblock 的 safeprobe 函数。而 [`blkid_do_fullprobe()`](https://github.com/util-linux/util-linux/blob/49a7b29e9f727dde4e8601f4d2ca2fbc4846258f/libblkid/src/probe.c#L1846) 的代码相差无几。只是 safeprobe 调用了探测 superblock 的 `superblocks_safeprobe()` 函数，而 fullprobe 调用了 superblock 的 `superblocks_probe()` 函数，这部分的源代码在[这里](https://github.com/util-linux/util-linux/blob/49a7b29e9f727dde4e8601f4d2ca2fbc4846258f/libblkid/src/superblocks/superblocks.c#L188-L198)。

而仔细观察 [`superblocks_safeprobe()`](https://github.com/util-linux/util-linux/blob/49a7b29e9f727dde4e8601f4d2ca2fbc4846258f/libblkid/src/superblocks/superblocks.c#L474)，会发现这个函数实际上也是循环调用 [`superblocks_probe()`](https://github.com/util-linux/util-linux/blob/49a7b29e9f727dde4e8601f4d2ca2fbc4846258f/libblkid/src/superblocks/superblocks.c#L352) 来进行探测而已。

看起来似乎没有什么问题。但两者却有关键的区别：
- `superblocks_probe()` 似乎一次只会探测一个 superblock，找到时就会返回结果。
- `superblocks_safeprobe()` 会一直调用 `superblocks_probe()`，直到所有可能的文件系统的 superblock 都探测完毕。当只探测到 1 个文件系统时，才会正常返回结果。

后来我又发现了 libblkid 实际上是可以打印调试信息的，因此我给 `blkid` 加上了调试信息打印的环境变量，重新运行了 blkid：

```bash
LIBBLKID_DEBUG="0xFFFF" blkid /dev/nvme0n1p2
```

这次的结果就有意思了：

```plaintext
18469: libblkid: LOWPROBE: --> starting probing loop [SUBLKS idx=-1]
...
18469: libblkid: LOWPROBE: [14] bcachefs:
18469: libblkid:   BUFFER: 	reuse: off=4096 len=512 (for off=4096 len=512)
18469: libblkid:   BUFFER: 	reuse: off=4096 len=512 (for off=4096 len=512)
18469: libblkid: LOWPROBE: 	magic sboff=24, kboff=4
18469: libblkid: LOWPROBE: 	call probefunc()
18469: libblkid: LOWPROBE: 	read: off=4096 len=1024
18469: libblkid: LOWPROBE: 	read: off=4096 len=5120
18469: libblkid: LOWPROBE: assigning UUID [superblocks]
18469: libblkid: LOWPROBE: assigning LABEL [superblocks]
18469: libblkid: LOWPROBE:  free value LABEL
18469: libblkid: LOWPROBE: assigning BLOCK_SIZE [superblocks]
...
18469: libblkid: LOWPROBE: <-- leaving probing loop (type=bcachefs) [SUBLKS idx=14]
18469: libblkid: LOWPROBE: saving superblocks values
18469: libblkid: LOWPROBE: --> starting probing loop [SUBLKS idx=14]
...
18469: libblkid: LOWPROBE: [47] zfs_member:
18469: libblkid: LOWPROBE: 	call probefunc()
18469: libblkid:    PROBE: probe_zfs
...
18469: libblkid: LOWPROBE: nvlist: size 36, namelen 6, name ashift
18469: libblkid: LOWPROBE: assigning BLOCK_SIZE [superblocks]
18469: libblkid: LOWPROBE: assigning TYPE [superblocks]
18469: libblkid: LOWPROBE: <-- leaving probing loop (type=zfs_member) [SUBLKS idx=47]
18469: libblkid: LOWPROBE: Resetting superblocks values
...
18469: libblkid: LOWPROBE: --> starting probing loop [SUBLKS idx=47]
...
18469: libblkid: LOWPROBE: ERROR: superblocks chain: ambivalent result detected (2 filesystems)!
```

这次的日志结果看起来是同时检测到了 bcachefs 和 zfs_member，因此认为这个分区上有两个文件系统。看起来是我在建立 bcachefs 文件系统之前，没有抹除分区上原来的 zfs_member 的签名数据。

接下来要找的就是 zfs_member 的签名了，不过在这里我没有直接用 `wipefs` 的工具来检查（因为当时不知道有这样的工具），而是直接使用了 `xxd` 来检查分区中的数据。

## ZFS
### uberblock

还是从 blkid 中，对 ZFS 进行检测的代码下手。ZFS 会在每个 vdev 的头尾各存放 2 个、总计 4 个 vdev label (vdev 标签)。可以看到对 ZFS 进行探测的代码*似乎*会检测 vdev label 中的存储的 uberblock (ZFS 的 superblock)

uberblock 位置是 vdev label 的起始位置加上 128 * 1024 (`0x20000`) 字节，因此用 xxd 定位这些 uberblock 的位置，果然在第 1 个 vdev label 中发现了 ZFS uberblock 的 Magic Number 和一片数据：

{{< image src=magic-zfs.webp >}}

看起来似乎只要把 Magic Number 抹除，blkid 就不会认出 ZFS 的 uberblock 了，于是我把 Magic Number 的地方都填充上了 0：

```bash
dd bs=1 seek=$(math 0x20000) count=$(math 8) if=/dev/zero of=/dev/nvme1n1p2
dd bs=1 seek=$(math 0x21000) count=$(math 8) if=/dev/zero of=/dev/nvme1n1p2
dd bs=1 seek=$(math 0x22000) count=$(math 8) if=/dev/zero of=/dev/nvme1n1p2
```

{{< notice warning >}}
使用 `dd` 直接操作硬盘中的数据是**非常危险**的。在对硬盘中的内容执行任何操作之前，请**仔细检查命令的参数**，确认 `dd` 的行为，并且最好在有备份的情况下进行操作。

不要*像我一样*这么随便。
{{</ notice >}}

{{< notice note >}}
`math` 指令是由 `fish` 提供的数学运算指令，可以进行数字之间的数学运算。
{{</ notice >}}

然后重新运行 blkid，然而 blkid 给出的结果却是一样的——它检测到了 zfs_member。

仔细阅读 blkid 的调试信息，会发现 ZFS 探测部分有一个名词叫 **nvlist**，我尝试在 [`util-linux` 的 GitHub 仓库](https://github.com/util-linux/util-linux/) 中寻找关于 nvlist 的内容，随后我发现了[将 uberblock 探测改为 nvlist 探测的 Commit](https://github.com/util-linux/util-linux/commit/41bc866143af5b1b65959bed299012478dfc8ada)，这个更新最终在 util-linux v2.41 版本中发布（[更新日志](https://github.com/util-linux/util-linux/blob/49a7b29e9f727dde4e8601f4d2ca2fbc4846258f/Documentation/releases/v2.41-ReleaseNotes#L515)），正好是两个月前我出现问题的时候。

之所以之前没有探测到 zfs_member，则是因为老版本的 blkid 需要所有的 4 个 vdev label 的位置都探测到 uberblock，才会认为这是一个 zfs_member。而当前版本中只需要正确探测到一个 nvlist 就可以认为这是一个 zfs_member，而我的硬盘上的 4 个 nvlist 都能被探测到。

那么问题已经很显然了——blkid 探测到了我硬盘上残留的 zfs_member 的 nvlist，所以认为这是一个 zfs_member。接下来就该确认一下 nvlist 的位置和内容了。

### nvlist
阅读了新版本 blkid 的代码后，会发现 nvlist 的位置是 vdev label 的起始位置加上 16 * 1024 (`0x4000`) 字节的偏移量：

```c
#define VDEV_LABEL_NVPAIR	( 16 * 1024ULL)
//...
for (label_no = 0; label_no < 4; label_no++) {
		offset = label_offset(pr->size, label_no) + VDEV_LABEL_NVPAIR;
//...
```

用 xxd 检查每个位置的内容：
```plaintext
$ xxd -s $(math 1024 x 256 x 0 + 0x4000) -l 256 -c 16 -g 1 /dev/nvme0n1p2
00004000: 01 01 00 00 00 00 00 00 00 00 00 01 00 00 00 24  ...............$
00004010: 00 00 00 20 00 00 00 07 76 65 72 73 69 6f 6e 00  ... ....version.
00004020: 00 00 00 08 00 00 00 01 00 00 00 00 00 00 13 88  ................
00004030: 00 00 00 24 00 00 00 20 00 00 00 04 6e 61 6d 65  ...$... ....name
00004040: 00 00 00 09 00 00 00 01 00 00 00 05 7a 72 6f 6f  ............zroo
00004050: 74 00 00 00 00 00 00 24 00 00 00 20 00 00 00 05  t......$... ....
00004060: 73 74 61 74 65 00 00 00 00 00 00 08 00 00 00 01  state...........
00004070: 00 00 00 00 00 00 00 00 00 00 00 20 00 00 00 20  ........... ...
00004080: 00 00 00 03 74 78 67 00 00 00 00 08 00 00 00 01  ....txg.........
00004090: 00 00 00 00 00 1f 7a 0b 00 00 00 28 00 00 00 28  ......z....(...(
000040a0: 00 00 00 09 70 6f 6f 6c 5f 67 75 69 64 00 00 00  ....pool_guid...
000040b0: 00 00 00 08 00 00 00 01 48 c1 c1 1c df d0 64 e6  ........H.....d.
000040c0: 00 00 00 24 00 00 00 20 00 00 00 06 65 72 72 61  ...$... ....erra
000040d0: 74 61 00 00 00 00 00 08 00 00 00 01 00 00 00 00  ta..............
000040e0: 00 00 00 00 00 00 00 2c 00 00 00 30 00 00 00 08  .......,...0....
000040f0: 68 6f 73 74 6e 61 6d 65 00 00 00 09 00 00 00 01  hostname........

$ xxd -s $(math 1024 x 256 x 1 + 0x4000) -l 256 -c 16 -g 1 /dev/nvme0n1p2
...
xxd -s $(math 0x3A205800 x 512 - 1024 x 256 x 2 + 0x4000) -l 256 -c 16 -g 1 /dev/nvme0n1p2
...
xxd -s $(math 0x3A205800 x 512 - 1024 x 256 x 1 + 0x4000) -l 256 -c 16 -g 1 /dev/nvme0n1p2
...
```

看起来似乎在每个 vdev label 的位置都发现了没有被正确抹除的 nvlist。

到这里，我搜寻了一下关于如抹除文件系统签名的信息，随后我发现了一个名叫 `wipefs` 的工具，可以检测分区中的文件系统签名，并在不破坏数据的情况下抹除这些文件系统签名。运行 `wipefs`，它也正确检测到了 bcachefs 和 zfs_member 的文件系统签名：

```plaintext
$ wipefs /dev/nvme0n1p2
DEVICE    OFFSET       TYPE       UUID                                 LABEL
nvme0n1p2 0x1018       bcachefs   efa45a42-33f3-4711-87b4-c63f27f1dd6c
nvme0n1p2 0x7440a00018 bcachefs   efa45a42-33f3-4711-87b4-c63f27f1dd6c
nvme0n1p2 0x4000       zfs_member 5242683770994189542                  zroot
nvme0n1p2 0x44000      zfs_member 5242683770994189542                  zroot
nvme0n1p2 0x7440a84000 zfs_member 5242683770994189542                  zroot
nvme0n1p2 0x7440ac4000 zfs_member 5242683770994189542                  zroot
```

位置正好也是每个 vdev label 中 nvlist 的位置。

这里尝试用 `wipefs` 来清除 zfs_member 的文件系统签名：

```plaintext
$ sudo wipefs -a -t zfs_member /dev/nvme0n1p2
wipefs: error: /dev/nvme0n1p2: probing initialization failed: Device or resource busy
```

看起来因为已经挂载了 `/dev/nvme0n1p2`，所以 `wipefs` 无法正常工作。如果是为了稳妥，这里可以考虑进入 LiveCD 环境再进行操作。不过因为很久没有更新过 LiveCD 了，所以我还是用了更危险的 `dd` 直接操作硬盘内容来破坏 nvlist。

我尝试将 nvlist 的头部的几个字节全部填充为 0，偶然间发现，将每个 nvlist 头部的 2 个字节（原本是 `01 01`）全部替换为 0 后，wipefs 就无法检测到 zfs_member 的文件系统签名了，而 blkid 也能正常列出 `/dev/nvme0n1p2` 了。

检查 libblkid 中对 ZFS 探测的代码 ([libblkid/src/superblocks/zfs.c](https://github.com/util-linux/util-linux/blob/master/libblkid/src/superblocks/zfs.c#L323))：

```c
// Line 41
struct nvs_header_t {
	char	  nvh_encoding;		/* encoding method */
	char	  nvh_endian;		/* endianess */
	char	  nvh_reserved1;
	char	  nvh_reserved2;
	uint32_t  nvh_reserved3;
	uint32_t  nvh_reserved4;
	uint32_t  nvh_first_size;	/* first nvpair encode size */
};
//...

// Line 316, inside probe_zfs()
        label = (struct nvs_header_t *) blkid_probe_get_buffer(pr, offset, VDEV_PHYS_SIZE);

        /*
		 * Label supports XDR encoding, reject for any other unsupported format. Also
		 * endianess can be 0 or 1, reject garbage value. Moreover, check if first
		 * nvpair encode size is non-zero.
		 */
        if (!label || label->nvh_encoding != 0x1 || !be32_to_cpu(label->nvh_first_size) ||
		    (unsigned char) label->nvh_endian > 0x1)
			continue;
//...
```

发现 nvlist 的第 1 个字节为 encoding，而第 2 个字节为 endian 标识。并且只有满足这些条件，libblkid 才会继续进行探测：
- `nvh_encoding` 为 1
- `nvh_endian` 为 0 或 1
- `nvh_first_size` 不为 0

否则，libblkid 会跳过这个 nvlist，去下一个 vdev label 尝试寻找有效的 nvlist。因此考虑通过修改 `nvh_encoding` 和 `nvh_endian` 的值来破坏 nvlist，让 libblkid 认为这个 nvlist 是无效的、从而跳过探测。

由于只需要修改 nvlist 头部的 2 个字节，这样的操作*或许*是足够安全的。接下来用 dd 将 `FF FF` 写入到 nvlist 的头部来破坏这个 nvlist：

```bash
echo "ffff" | xxd -r -p > head
dd bs=1 seek=$(math 0x4000) count=$(math 2) if=head of=/dev/nvme0n1p2
dd bs=1 seek=$(math 0x44000) count=$(math 2) if=head of=/dev/nvme0n1p2
dd bs=1 seek=$(math 0x7440a84000) count=$(math 2) if=head of=/dev/nvme0n1p2
dd bs=1 seek=$(math 0x7440ac4000) count=$(math 2) if=head of=/dev/nvme0n1p2
```

{{< notice warning >}}
使用 `dd` 直接操作硬盘中的数据是**非常危险**的。在对硬盘执行任何操作之前，请**仔细检查命令的参数**，确认 `dd` 的行为，并且最好在有备份的情况下进行操作。
{{</ notice >}}

用 `wipefs` 和 `blkid` 检查：

```plaintext
$ wipefs /dev/nvme0n1p2
DEVICE    OFFSET       TYPE     UUID                                 LABEL
nvme0n1p2 0x1018       bcachefs efa45a42-33f3-4711-87b4-c63f27f1dd6c
nvme0n1p2 0x7440a00018 bcachefs efa45a42-33f3-4711-87b4-c63f27f1dd6c
$ blkid
/dev/nvme0n1p1: UUID="8629-150B" BLOCK_SIZE="512" TYPE="vfat" PARTLABEL="EFI_Part" PARTUUID="9a38d8bb-3f5c-5b44-beb6-707df431ec4e"
/dev/nvme1n1p2: LABEL="Windows" BLOCK_SIZE="512" UUID="08F6B9A8F6B99702" TYPE="ntfs" PARTUUID="10b0e52b-dbea-4855-927a-46617ff1b2df"
/dev/nvme1n1p1: UUID="014986a5-c608-4ead-a72c-739a8a89e19d" UUID_SUB="c6bc9643-d474-44c2-811d-20730a2a7962" BLOCK_SIZE="4096" TYPE="btrfs" PARTLABEL="Basic data partition" PARTUUID="66604c58-0bb7-4828-8a6d-bed86c9d7f4a"
/dev/nvme0n1p2: UUID="efa45a42-33f3-4711-87b4-c63f27f1dd6c" BLOCK_SIZE="512" UUID_SUB="fbeecf13-9755-4ac9-9fc8-ba85eb9432b4" TYPE="bcachefs" PARTLABEL="Linux_Root" PARTUUID="5b484aa9-94db-4ab3-a2d6-0727effe4af0"
```

看起来 wipefs 没有识别到 zfs_member 的文件系统签名、blkid 正确地列出了 `/dev/nvme0n1p2`，并且重启之后也能正常挂载根文件系统。我想现在可以认为「双重文件系统签名」的问题已经解决了。

### 结语
虽然排障过程有些长，但问题的根本原因却很简单：**文件系统签名残留**和 **blkid 探测逻辑更新**。

现在回想起来，自己在从 ZFS 切换到 bcachefs 确实没有使用 wipefs 等方式正确清除分区上原本存在的文件系统。由于 ZFS 的一部分 uberblock 确实被心得文件系统破坏掉了，因此 blkid 暂时没有探测到 ZFS 分区。但新版本的 blkid 却将探测方式修改为了 nvlist，并且 4 个 nvlist 都还存在，所以才让 blkid 误认为这个分区上存在两个文件系统。