+++
name = "uki-linux-boot"
title = "Boot Linux using Unified Kernel Image"
tags = ["Linux", "UEFI"]
date = "2023-06-21"
update = "2024-10-14"
enableGitalk = true
+++

### Foreword
I was using [GRUB](https://wiki.archlinuxcn.org/wiki/GRUB) as bootloader, but using GRUB doesn't comfort me. UEFI firmware can execute executable EFI files directly, a 2nd bootloader is not strongly required. Besides, GRUB will show a boot option menu by default, but I'm not interested in customizing this menu.

It's possible to boot Linux without a 2nd bootloader. So I decided to let the UEFI firmware boot Linux directly instead of boot via GRUB.

## Different Ways to Boot
### Boot via GRUB
On legacy BIOS platforms, [**Master Boot Record (MBR)**](https://en.wikipedia.org/wiki/Master_boot_record) partition table is commonly used. When creating MBR disks, usually we leave a margin of about 1-2 MB between MBR and the first partition. This spare space is called **post-MBR gap**. While installing GRUB, installer will embed GRUB into post-MBR gap and rewrite MBR, codes in MBR will boot GRUB. When computer boots up, BIOS will first execute codes in MBR, codes is MBR will then load and boot GRUB.

If [**GUID Partition Table (GPT)**](https://en.wikipedia.org/wiki/GUID_Partition_Table) is used, GRUB will be installed into the **BIOS boot partition**. While booting, BIOS will load and boot GRUB from that partition.

On UEFI platforms, GRUB is present as a **executable EFI file**. It's usually installed to the **EFI System Partition (ESP)**. While installing, installer will also add a GRUB boot option into the UEFI boot sequence. After selecting GRUB boot option in UEFI firmware, it will load and boot GRUB from EFI system partition.

After GRUB is booted, GRUB will present boot options according to its configuration file. GRUB can read ext4 and BtrFS filesystem, therefore it's possible to store Linux kernel and initramfs in Linux root filesystem (usually they are stored in `/boot`). GRUB will load Linux kernel (`vmlinux` or `vmlinuz`) and initramfs to RAM and afterwards run Linux.

### Boot via EFISTUB
[EFISTUB](httpss://wiki.archlinux.org/title/EFISTUB) is enabled if linux is compiled with `CONFIG_EFI_STUB=y`. Linux provided by Arch Linux has EFISTUB enabled by default. Linux kernel image compiled with EFISTUB enabled contains a piece of code called [UEFI Boot Stub](https://docs.kernel.org/admin-guide/efi-stub.html), it will be executed first when the kernel image is executed. UEFI Boot Stub will modify the kernel loaded, making it bootable before booting the kernel. UEFI Boot Stub is just like a bootloader embedded in kernel image.

UEFI boot sequence can be modified using tools like `efibootmgr`. After adding the boot option of Linux kernel image with proper arguments, when you select that boot option, UEFI firmware will boot the Linux kernel image.

## Unified Kernel Image (UKI)
Linux kernel and resources required in the boot process can be bundled into a **executable EFI file**. This EFI file is a [**Unified Kernel Image (UKI)**](https://wiki.archlinux.org/title/Unified_kernel_image). A UKI may contain:
- UEFI Boot Stub，like [systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html)
- Linux Kernel Image
- [initramfs Image](https://wiki.archlinux.org/title/Arch_boot_process#initramfs)
- [Kernel Parameters](https://wiki.archlinux.org/title/Kernel_parameters)
- [CPU Microcodes](https://wiki.archlinux.org/title/Microcode)
- Splash Screen

Compared to EFISTUB, UKI bundled initramfs and CPU microcodes that will be used in the boot process. This makes UKI more integrated and convenient than Linux kernel image with EFISTUB enabled. With few configuration, UKI will be able to boot from UEFI firmware.

### Structure of UKI
UKI is an **executable EFI file**, and an EFI file is also a **PE/COFF file**. Using UKI on my system as an example, its PE segment list is like this: 

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

Among these segments:
- `.linux` contains Linux kernel image
- `.initrd` contains initramfs and CPU microcodes
- `.splash` contains splash screen image

There are also segments that are not used in my UKI such as `.cmdline`, which contains embedded kernel parameters. 

### systemd-stub and UKI Creation
Just like UEFI Boot Stub in EFISTUB, [systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html) implemented similar functionality. They will be executed first, load kernel and related resources, then boot Linux kernel. systemd-stub provides **executable EFI file with only the part of UEFI Boot Stub**, they are used as empty templates.

When UKI is booted, systemd-stub will load Linux kernel from ELF formatted Linux kernel in `.linux` segment, initramfs and microcodes from `.initrd` segment, kernel parameters from `.cmdline`, etc. We can **make an UKI by adding PE segments into empty templates**.

[mkinitcpio](https://wiki.archlinux.org/title/Mkinitcpio) and [dracut](https://wiki.archlinux.org/title/Dracut) can not only create initramfs but also create UKI. Next, I will demonstrate how to create UKI using mkinitcpio.

## Create UKI using mkinitcpio
Before creating UKI, we need to modify mkinition presets and the kernel parameters.

### Embed Kernel Parameters
If you need embedded kernel parameters, create `/etc/kernel/cmdline` and write kernel parameters into that file. Here is an example:

```plain
root=UUID=b9fb5b31-07f1-408c-9447-10a1b2476b4d rw splash loglevel=3
```

mkinitcpio will read the content in this file and embed into UKI.

{{< notice note >}}
You can also add kernel parameters in UEFI boot options. Notice that if Secure Boot is enabled and UKI has embedded kernel parameters. UKI will only use **embedded kernel parameters** and ignore external parameters. See [systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html).
{{</ notice >}}

### Modify mkinitcpio Presets
[mkinitcpio](https://wiki.archlinux.org/title/mkinitcpio) can create UKI, but it needs some configuration on its presets. Modify `/etc/mkinitcpio.d/linux.preset`:
- Uncomment `PRESET_uki=...` to enable UKI creation, this variable indicates where to store UKI
- Comment `PRESET_image` to disable initramfs image creation

UKI should be stored in ESP. For a example, if the system is Arch Linux with mainline `linux` kernel and ESP is mounted at `/efi`, the modified `linux.preset` should look like this:

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
- To embed splash screen into UKI, just uncomment `<PRESET_NAME>_options` and add `--splash /path/to/your/splash_picture.bmp` into it.
- If it's require to set kernel parameters separately, add `--cmdline /path/to/your/cmdline` to `<PRESET_NAME>_options`.
- If embedded kernel parameters is not used, add `--no-cmdline` to `<PRESET_NAME>_options`.
{{</ notice >}}

Now use mkinitcpio to create UKI:

```bash-session
$ mkdir -p /efi/EFI/Linux
$ mkinitcpio -p linux
```

## Boot UKI

{{< notice warning >}}
UKI is not signed. If Secure Boot is enabled, UEFI firmware will refuse to boot UKI. To boot UKI without valid signatures, make sure Secure Boot is disabled.
{{</ notice >}}

### Boot via UEFI Boot Options

Here we use [efibootmgr](https://github.com/rhboot/efibootmgr) for demonstration, adding a boot option into the UEFI boot sequence:

```bash-session
$ efibootmgr --create \
    -d /dev/sdX -p Y \
    --label "Arch Linux" \
    --loader "EFI/Linux/arch-linux.efi"
```

In this command, `sdX` is the name of the device where ESP resides, `Y` is the partition number of ESP. `--loader` indicates the path to our UKI in ESP.

If you want to add kernel parameters in the UEFI boot option, use `-u parameter` to assign extra parameters encoded in UTF-16:

```bash-session
$ efibootmgr --create \
>   -d /dev/sdX -p Y \
>   --label "Arch Linux" \
>   --loader "EFI/Linux/arch-linux.efi" \
>   -u "root=UUID=b9fb5b31-07f1-408c-9447-10a1b2476b4d rw splash loglevel=3"
```

### Boot via UEFI Shell
Sometimes you may want to boot a UKI, but you don't want, or forget to add it into the boot sequence. You can go to the UEFI Shell to run UKI manually. 

After getting into to UEFI Shell, at first it will usually display available filesystem (FS) and block devices (BLK). You can use `map` command to display these information later. They look like this:

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

Find ESP in available filesystems and use following commands to enter the ESP and run UKI:

```plain
Shell> FS0:
FS0:\> cd EFI\Linux
FS0:\EFI\Linux> arch-linux.efi root=UUID=b9fb5b31-07f1-408c-9447-10a1b2476b4d rw splash loglevel=3
```

You will probably use your own parameters and filesystem number. After executing the last command, linux should boot.

## About Secure Boot
It's required to sign UKI to make UEFI firmware accept to boot UKI in platforms with Secure Boot enabled. Most devices uses certificates from Microsoft (and also vendor), which means **only images signed by Microsoft will be accepted by the UEFI firmware**. This also means that you need to **replace existing certificates with your own certificates** to boot your own UKI on platforms with Secure Boot enabled. 

Since configuring Secure Boot is quite complicated, I will introduce Secure Boot in another article.

### Ending
At first I thought it was a short article about how to create and use UKI, I did't expect iw will be so long. Although objdump and codes took a lot space, other contents are still quite large.

I almost thought it's just rewriting Wiki, but I learned a lot while writing this article and added my own understanding. From different ways to boot, structure of UKI, to creating and booting UKI. I have reviewed lots of materials, which enhanced my understanding to the boot process.

- - -
### Related Materials
- [Unified Kernel Image - ArchWiki](https://wiki.archlinux.org/title/Unified_kernel_image)
- [EFISTUB - ArchWiki](https://wiki.archlinux.org/title/EFISTUB)
- [systemd-stub](https://www.freedesktop.org/software/systemd/man/systemd-stub.html)
- [The EFI Boot Stub - The Linux Kernel Documentation](https://docs.kernel.org/admin-guide/efi-stub.html)
- [GRUB - ArchWiki](https://wiki.archlinux.org/title/GRUB)
- [Partitioning - ArchWiki](https://wiki.archlinux.org/title/Partitioning)