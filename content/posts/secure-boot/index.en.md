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
Secure Boot is a part of UEFI standard. It ensures that **only trusted EFI binaries are loaded** by **verifying their digital signatures** before loading EFI binaries (UEFI firmware, UEFI drivers, UEFI applications, bootloaders, etc.). This prevents untrusted EFI binaries from being loaded before booting up the OS. Since programs loaded the OS are privileged and can directly access hardwares, therefore it's possible to perform attacks by loading malware ahead of the OS. Secure Boot blocks untrusted malware, therefore it provides protection against such type of attack (Rootkit).

For manufacturers and vendors, Secure Boot ensures that only softwares trusted by OEMs can be loaded, preventing users from privileged operations like debugging the device or reading proprietary softwares. Thus many PC/Mobile Phone manufacturers and vendors will keep Secure Boot enabled. For many motherboard manufacturers however, their products for DIY markets usually have Secure Boot disabled by default while also enabling Compatibility Support Module to support legacy BIOS boot.

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
Using signed bootloaders like [shim](https://aur.archlinux.org/packages/shim-signed) to load other EFI binaries. shim won't load EFI binaries without a valid signature. It uses **Machine Owner Key List (MokList)**. EFI binaries will be loaded only when the binary is signed with corresponding privates keys of public keys in MokList or its hash is in MokList. Otherwise bootloader will refuse to load the EFI binary. You can manage MokList using tools provided by the bootloader.

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
> # Sign EFI signature list containing db certificates with KEK
$ sign-efi-sig-list -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db new_db.esl new_db.auth
```

If you want to append certificates instead of replacing existing certificates, sign with option `-a`:

```bash-session
$ sign-efi-sig-list -a -g "$(cat GUID.txt)" -k KEK.key -c KEK.crt db new_db.esl new_db.auth
```

### Adding Other Certificates
{{< notice warning >}}
This step is important! UEFI firmware may be signed by keys from Microsoft or device manufacturers. If you only install your own db certificates and set Secure Boot to enable, **UEFI firmware may not be loaded and the device may brick**.

I encountered this problem. Eventually I recovered by flashing BIOS and CMOS clearing.
{{</ notice >}}

#### Adding Certificates From Microsoft
After downloading certificates from Microsoft, we need to convert the certificates to EFI certificate list. Here we use the 2011 version certificates as an example:

{{< notice note >}}
Here we set GUID to `77fa9abd-0359-4d32-bd60-28f4e78f784b`, this is Microsoft's owner GUID.
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

If backup contains other certificates, you can also install them like this.

### Sign EFI Binaries
Use following command to sign an EFI binary:

```bash-session
$ sbsign --key db.key --cert db.crt --output file.efi file.efi
```

Use following command to verify an EFI binary:

```bash-session
$ sbverify --cert db.crt file.efi
```

#### Use mkinitcpio Post Hoos To Automate Signing
Post hooks are scripts that will be run by mkinitcpio after it successfully created an image. The 1st argument is the path to core, the 2nd argument is the path to initramfs image, the 3rd argument is the path to UKI.

Here we use mkinitcpio post hooks to automatically sign UKI generated by mkinitcpio.

Create file `/etc/initcpio/post/uki-sbsign` and set it to executable. Here is an example script:

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

### Enrolling Certificates
Here, I will demonstrate two different ways to enroll certificates.

{{< notice tip >}}
If dbx certificates are not require, you can ignore dbx certificates.
{{</ notice >}}

{{< notice warning >}}
Installing PK certificate will send the device back to user mode. It recommended to install PK certificate in the last.

If `KEK.auth` is not signed properly by PK, after installing PK certificates, you will not be able to install KEK certificates.
{{</ notice >}}

#### Using sbkeysync
sbsigntools provides command `sbkeysync` to update certificates.

First we create required directories:

```bash-session
$ mkdir -p /etc/secureboot/keys/{db,dbx,KEK,PK}
```

Then we copy `.auth` files to corresponding directories, eg. `PK.auto` to `/etc/secureboot/keys/PK/`.

Run sbkeysync with `--dry-run` to confirm changes that will be made before actually updating certificates.

```bash-session
$ sbkeysync --pk --dry-run --verbose
```

Linux kernel exposes UEFI variables through [**efivarfs**](https://wiki.archlinux.org/title/Unified_Extensible_Firmware_Interface#UEFI_variables_support_in_Linux_kernel), making it visible in user space. Usually efivarfs will be mounted at `/sys/firmware/efi/efivars`. sbkeysync updates UEFI variables through modifiyng files in `/sys/firmware/efi/efivars`. However these files may have `i` attribute (immutable). Therefore you may use `chattr` to remove `i` attribute temporarily, allowing sbkeysync update certificates.

Use following command to remove `i` attribute of target files:

```bash-session
chattr -i /sys/firmware/efi/efivars/{PK,KEK,db}*
```

Then update or install certificates.

```bash-session
$ sbkeysync --verbose
$ sbkeysync --verbose --pk
```

#### Using UEFI BIOS
Some UEFI firmware allows you to manage certificates through their UEFI firmware configuration tool (aka. BIOS).

Many UEFI firmware only supports FAT filesystem, therefore you need to copy your certificates to a FAT filesystem. It's also OK to place them in your EFI boot partition.

First, copy all `.cer`/`.esl`/`.auth` files except `noPK.auth` to a FAT filesystem that is accessible from your firmware. Go to the options related to Secure Boot, then select installing certificates from external storage. UEFI firmware may ask what type is this file. Here are some common options:
- **Key Certificate Blob**, matches `.cer` certificate files
- **UEFI Secure Variable**, matches `.esl` certificate files
- **Authenticated Variable**, which is signed UEFI variables, matches `.auth` certificate files

It's recommended to use `.auth` file if UEFI firmware supports.

### Enabling Secure Boot
Now, enable Secure Boot and then reboot the device. If you did it correctly, your device should boot OS normally.

If devices can not boot OS and you can not get to the configuration tool (BIOS interface), that's probably because UEFI firmware is signed with a key that is not trusted (corresponding certificate is not installed). You can try to flash your UEFI firmware to the motherboard.

Now, you have completed implementing Secure Boot using your own keys.

### Ending
I have to say, I paid much time and energy to this article. Before writing this article, I don't know much about Secure Boot and I only know Secure Boot ensures only trusted images will be loaded.

After seeing content about signing [UKI](https://wiki.archlinux.org/title/UKI) on ArchWiki. I tried implementing Secure Boot on my machine. I almost thought I bricked my machine that day. Then encountered problems with my ZFS pool... Anyway, it's been a long day.

I was thinking about writing an article about Secure Boot after that day, so here it is. It's much longer than my article about ZFS. Durning writing, I searched a lot materials and modified many texts that is confusing (Although it's still quite confusing...), and I made it, finished this article.

Finally, thank you for reading my article. Hope this article will help you.

- - -
### Related Materials
- [Unified Extensible Firmware Interface/Secure Boot - ArchWiki](https://wiki.archlinux.org/title/Unified_Extensible_Firmware_Interface/Secure_Boot)
- [Secure Boot - Arch Linux 中文维基](https://wiki.archlinux.org/title/Unified_Extensible_Firmware_Interface/Secure_Boot)
- [Secure Boot | Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/oem-secure-boot)
- [Unified Extensible Firmware Interface (UEFI) Specification (March 2021)](https://uefi.org/sites/default/files/resources/UEFI_Spec_2_9_2021_03_18.pdf)
- [UEFI Secure Boot in Modern Computer Security Solutions (Aug 2019)](https://uefi.org/sites/default/files/resources/UEFI_Secure_Boot_in_Modern_Computer_Security_Solutions_2019.pdf)
- [A Tour Beyond BIOS Implementing UEFI Authenticated Variables in SMM with EDKII (Oct 2015)](https://raw.githubusercontent.com/tianocore-docs/Docs/master/White_Papers/A_Tour_Beyond_BIOS_Implementing_UEFI_Authenticated_Variables_in_SMM_with_EDKII_V2.pdf)
- [UEFI - Wikipedia](https://en.wikipedia.org/wiki/UEFI#Secure_Boot)
- [Windows Secure Boot Key Creation and Management Guidance | Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-secure-boot-key-creation-and-management-guidance?view=windows-11)
- [mkinitcpio.8 About Post Hooks](https://man.archlinux.org/man/mkinitcpio.8#ABOUT_POST_HOOKS)