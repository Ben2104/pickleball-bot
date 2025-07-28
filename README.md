# Pickleball-Reservation-Bot


# 🏓 Pickleball Reservation Bot

A Chrome Extension that automates the court booking process at iPickle Cerritos. Designed to handle the high demand and fast-paced reservation system by automatically booking courts as soon as they become available — **7 days in advance at 7:00 AM**.


## 🚀 Motivation

Due to the high demand for court reservations at iPickle Cerritos, it’s extremely competitive to book a slot as soon as it becomes available, 7 days in advance. This reservation bot streamlines the process, saving time and increasing your chances of securing a court.
## 📌 Features

- ⏰ **Auto-booking**: Automatically attempts to reserve your preferred court at exactly 7:00 AM each morning.
- 📅 **Schedule Button**: Manually schedule a booking attempt with a single click.
- 🥇 **Smart Court Selection**: Books courts based on a **quality priority system**—trying the best courts first.
- ✅ **One-Time Try**: Will retry after the first attempt—ensuring no duplicate or excessive requests.
- 📷 **Recording**: The bot captures a video of each reservation attempt to help with debugging and verifying that the booking process works as expected.
## 🎯 Court Priority Logic

The extension uses a built-in court priority map based on user experience and court quality. It tries to reserve the best courts first, in this order:

1. PICKLEBALL 2  
2. PICKLEBALL 4  
3. PICKLEBALL 8  
4. PICKLEBALL 9  
5. PICKLEBALL 3  
6. PICKLEBALL 6  
7. PICKLEBALL 7  
8. PICKLEBALL 1  
9. PICKLEBALL 5  
10. PICKLEBALL 10

## Technology
- JavaScript, Playwright for Website interaction
- Github Action
- Cron-Jobs.org for scheduling

## 🔒 Disclaimer

This tool is intended for **personal use only** and should be used responsibly. It does not bypass any security or fair usage rules set by iPickle Cerritos.

---
