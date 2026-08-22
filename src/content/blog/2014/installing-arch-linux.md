---
title: "Installing Arch Linux Without Losing the Plot"
description: "A compact installation checklist, with the reasoning left in."
slug: "install-arch-linux"
date: 2014-08-25T14:32:00Z
updated: 2015-01-03T09:20:00Z
author: "Demo Author"
categories:
  - Linux
tags:
  - Arch Linux
  - Tutorial
legacyUrl: "/2014/08/25/install-arch-linux/"
---

The installation guide is the source of truth. This note is the map I wish I had beside it: fewer commands, more explanation of the transitions between them.

## Prepare the disks

Check the target twice before changing it:

```bash
lsblk -f
```

Create the partitions that fit the machine, format them, and mount the future root filesystem at `/mnt`.

> The dangerous command is rarely the complicated one. It is the simple command pointed at the wrong disk.

## Install the base system

Once networking and mounts are verified, install the smallest useful base:

```bash
pacstrap /mnt base linux linux-firmware
genfstab -U /mnt >> /mnt/etc/fstab
arch-chroot /mnt
```

### Configure the essentials

Inside the new system, set the time zone, locale, hostname, root password, and boot loader. Do one reboot before adding a desktop environment; it keeps failures easy to locate.

## Keep the result boring

Write down every non-default choice. Six months later, that short record is more valuable than an elaborate install script used once.
