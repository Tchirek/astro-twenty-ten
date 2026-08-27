---
title: "Systemd Timers I Can Read Six Months Later"
description: "A small pattern for scheduled jobs with visible logs and predictable timing."
slug: "systemd-timers"
date: 2021-06-12T10:15:00Z
author: "Demo Author"
categories:
  - Linux
  - Programming
tags:
  - systemd
  - Automation
permalink: "/2021/06/12/systemd-timers/"
---

> Demonstration content: this fictional post is retained as a theme fixture.

Cron is excellent when a line of schedule syntax tells the whole story. For jobs that need dependencies, missed-run handling, and logs, a timer and service pair is easier to inspect.

## The service

Keep the work in an ordinary executable and let the unit describe only how to run it:

```ini
[Unit]
Description=Refresh the local notes index

[Service]
Type=oneshot
ExecStart=/usr/local/bin/refresh-notes
```

## The timer

```ini
[Unit]
Description=Refresh notes every morning

[Timer]
OnCalendar=*-*-* 07:30:00
Persistent=true
RandomizedDelaySec=5m

[Install]
WantedBy=timers.target
```

`Persistent=true` runs a missed event after the machine wakes. The randomized delay matters when many machines would otherwise call the same service at once.

## Inspect before guessing

```bash
systemctl list-timers --all
journalctl -u refresh-notes.service
```

Those two commands answer most questions without adding custom logging.
