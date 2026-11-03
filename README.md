# Pickleball-Reservation-Bot

[212b8bb846d5762d0e0c45e2e070d59b.webm](https://github.com/user-attachments/assets/3bdd87fb-d20e-4cb7-8b19-bbf8250bb438)

# 🏓 Pickleball Reservation Bot

An automation bot that automates the court booking process at iPickle Cerritos. Designed to handle the high demand and fast-paced reservation system by automatically booking courts as soon as they become available — **7 days in advance at 7:00 AM**.


## 🚀 Motivation

Due to the high demand for court reservations at iPickle Cerritos, it’s extremely competitive to book a slot as soon as it becomes available, 7 days in advance. This reservation bot streamlines the process, saving time and increasing your chances of securing a court.
## 📌 Features

- ⏰ **Auto-booking**: Automatically attempts to reserve your preferred court at exactly 7:00 AM each morning.
- 📅 **Schedule Button**: Manually schedule a booking attempt with a single click.
- 🥇 **Smart Court Selection**: Books courts based on a **quality priority system**—trying the best courts first.
- ✅ **One-Time Try**: Will retry after the first attempt—ensuring no duplicate or excessive requests.
- 📷 **Recording**: The bot captures a video of each reservation attempt to help with debugging and verifying that the booking process works as expected.
- 📆 Automatically integrates with Google Calendar via the Google Calendar API for easy sharing with friends.

## Technology
- JavaScript, Playwright for Website interaction
- Github Action
- Cron-Jobs.org for scheduling
- Google Calendar API
## Self-hosted runner

The booking workflow runs on a self-hosted runner with the labels `self-hosted` and `linux`.
cron-jobs.org still starts it through `repository_dispatch`.
Manual runs use `workflow_dispatch`.
There is no `pull_request` trigger.
Set the dispatch input `dry_run` to stop before the Book click.
`DRY_RUN=1` or `DRY_RUN=true` does the same thing for a local run.

The VPS needs Node.js 20 or newer.
Install Chromium's system libraries once, as root: `sudo npx playwright install-deps chromium`.
The job does not run apt.
Playwright must be 1.64.1 or newer so Chromium has an Ubuntu 26.04 build.
The job runs `npm ci` only when `node_modules/.lock-hash` does not match `package-lock.json`.
The job runs `npx playwright install chromium` only when that version's Chromium executable is missing.
Both caches live under the runner user's home directory, so the next run skips them.
The job sets `NODE_ENV=production`, so Chromium is headless and xvfb is not required.

GitHub Actions secrets, unchanged: `EMAIL`, `PASSWORD`, `EMAIL2`, `PASSWORD2`, `EMAIL3`, `PASSWORD3`, `EMAIL4`, `PASSWORD4`, `EMAIL5`, `PASSWORD5`, and `GOOGLE_CREDENTIALS`.
A local run needs `EMAIL` and `PASSWORD` in the environment.
`GOOGLE_CREDENTIALS` is optional. Calendar writes are skipped when it is absent.

## 🔒 Disclaimer

This tool is intended for **personal use only** and should be used responsibly. It does not bypass any security or fair usage rules set by iPickle Cerritos.

---
