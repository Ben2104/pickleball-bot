// playwright-booking-bot.js
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { mkdir } from 'fs/promises';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
dotenv.config();

const email = process.env.EMAIL ? String(process.env.EMAIL).trim() : '';
const password = process.env.PASSWORD ? String(process.env.PASSWORD).trim() : '';
const USER_NAME = process.env.USER_NAME || 'Khoi Do'; // default to Khoi if there is no USER set
const hr = "(//div[contains(@class,'Countdown')]//td)[1]";
const min = "(//div[contains(@class,'Countdown')]//td)[3]";
const sec = "(//div[contains(@class,'Countdown')]//td)[5]";
let selectedCourt = null;
// Add validation here
if (!email || !password) {
    console.error('❌ Missing required environment variables:');
    if (!email) console.error('  - EMAIL is not set');
    if (!password) console.error('  - PASSWORD is not set');
    console.error('Please create a .env file with EMAIL and PASSWORD or set them as environment variables');
    process.exit(1);
}

console.log(`✅ Environment variables loaded. Email: ${email.substring(0, 3)}***`);

const BOOKING_URL = '/book/ipicklecerritos';
const COURT_TYPE = 'Pickleball';

let TIME_SLOTS;
let courtPriorityMap;

if (USER_NAME === 'Khoi Do') {
    TIME_SLOTS = ["7-7:30am", "7:30-8am", "8-8:30am", "8:30-9am"];
    courtPriorityMap = new Map([
        [0, "PICKLEBALL 2"],
        [1, "PICKLEBALL 4"],
        [2, "PICKLEBALL 8"],
        [3, "PICKLEBALL 9"],
        [4, "PICKLEBALL 3"],
        [5, "PICKLEBALL 6"],
        [6, "PICKLEBALL 7"],
        [7, "PICKLEBALL 1"],
        [8, "PICKLEBALL 5"],
        [9, "PICKLEBALL 10"],
    ]);
}
else if (USER_NAME === 'Marvin') {
    TIME_SLOTS = ["7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm"];
    courtPriorityMap = new Map([
        [0, "PICKLEBALL 5"],
        [1, "PICKLEBALL 10"],
        [2, "PICKLEBALL 7"],
        [3, "PICKLEBALL 2"],
        [4, "PICKLEBALL 8"],
        [5, "PICKLEBALL 4"],
        [6, "PICKLEBALL 1"],
        [7, "PICKLEBALL 6"],
        [8, "PICKLEBALL 3"],
        [9, "PICKLEBALL 9"],
    ]);
}
const CALENDAR_ID = '65b939118e3c9b5e436484429b3cecb9c9b6c7d326ba770071f1aeeb0d7a5bba@group.calendar.google.com';
const BOOKING_HOUR = parseInt(process.env.BOOKING_HOUR) || 7;
const BOOKING_MINUTE = parseInt(process.env.BOOKING_MINUTE) || 0;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Stealth configuration
const STEALTH_CONFIG = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezone: 'America/Los_Angeles',
    permissions: ['geolocation'],
    geolocation: { latitude: 33.8703, longitude: -118.0895 }, // Cerritos, CA coordinates
};
// Function to parse time slots and get start/end times
function parseTimeSlots(timeSlots) {
  console.log('🕒 Parsing time slots:', timeSlots);
  
  // Get first slot start time - need to preserve AM/PM from the slot
  const firstSlot = timeSlots[0]; // "7-7:30pm"
  const startTime = firstSlot.split('-')[0]; // "7"
  
  // Get last slot end time
  const lastSlot = timeSlots[timeSlots.length - 1]; // "8:30-9pm"  
  const endTime = lastSlot.split('-')[1]; // "9pm"
  
  // For start time, we need to infer AM/PM from the slot
  // If the slot contains 'pm', the start time should also be 'pm'
  // If the slot contains 'am', the start time should also be 'am'
  let startTimeWithPeriod = startTime;
  if (firstSlot.includes('pm')) {
    startTimeWithPeriod = startTime + 'pm';
  } else if (firstSlot.includes('am')) {
    startTimeWithPeriod = startTime + 'am';
  }
  
  console.log('⏰ Start time:', startTimeWithPeriod);
  console.log('⏰ End time:', endTime);
  
  return { startTime: startTimeWithPeriod, endTime };
}

// Function to convert time string to 24-hour format
function convertTo24Hour(timeStr) {
  const isPM = timeStr.includes('pm');
  const isAM = timeStr.includes('am');
  
  // Remove 'am' or 'pm' and handle cases like "7", "7:30", "9"
  const cleanTime = timeStr.replace(/(am|pm)/g, '').trim();
  
  let hour, minute;
  
  if (cleanTime.includes(':')) {
    [hour, minute] = cleanTime.split(':');
  } else {
    hour = cleanTime;
    minute = '00';
  }
  
  // Convert to 24-hour format
  let hour24 = parseInt(hour);
  
  if (isPM && hour24 !== 12) {
    hour24 += 12;
  } else if (isAM && hour24 === 12) {
    hour24 = 0;
  }
  
  return `${hour24.toString().padStart(2, '0')}:${minute}:00`;
}

// const auth = new google.auth.GoogleAuth({
//     credentials: JSON.parse(readFileSync(credentialsFile, 'utf-8')),
//     scopes: ['https://www.googleapis.com/auth/calendar'],
// });

// const calendar = google.calendar({ version: 'v3', auth });
// Replace with this robust Google Auth setup:
let auth;
let calendar;

try {
    if (process.env.GOOGLE_CREDENTIALS) {
        console.log('🔑 Using Google credentials from environment variable');

        let credentials;
        try {
            credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            console.log('✅ Google credentials JSON is valid');
            console.log('📧 Service account email:', credentials.client_email);
        } catch (jsonError) {
            console.error('❌ Invalid JSON in GOOGLE_CREDENTIALS:', jsonError.message);
            throw new Error('Invalid GOOGLE_CREDENTIALS JSON format');
        }

        auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

    } else if (existsSync('./credentials.json')) {
        console.log('🔑 Using Google credentials from file');
        auth = new google.auth.GoogleAuth({
            keyFile: './credentials.json',
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

    } else {
        console.log('⚠️ No Google credentials found - calendar integration will be skipped');
        auth = null;
    }

    if (auth) {
        calendar = google.calendar({ version: 'v3', auth });
        console.log('✅ Google Calendar integration configured');
    }

} catch (error) {
    console.error('❌ Error setting up Google Auth:', error.message);
    auth = null;
    calendar = null;
}
export async function addCalendarEvent(startDateTime, endDateTime) {
    // Skip if no auth configured
    if (!auth || !calendar) {
        console.log('⚠️ Google Calendar not configured - skipping calendar integration');
        return null;
    }

    try {
        console.log('📅 Starting Google Calendar integration...');
        console.log('🔑 Testing Google Calendar authentication...');

        // Test authentication first
        const authClient = await auth.getClient();
        console.log('✅ Authentication successful');

        console.log('🔍 Attempting to create event...');
        console.log('Start time:', startDateTime);
        console.log('End time:', endDateTime);

        const event = {
            summary: `🏓 ${USER_NAME}'s court,  court: ${selectedCourt}`,
            location: 'iPickle Cerritos',
            description: `${USER_NAME}'s court,  court: ${selectedCourt}`,
            start: {
                dateTime: startDateTime,
                timeZone: 'America/Los_Angeles',
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'America/Los_Angeles',
            },
        };

        console.log('📅 Event object:', JSON.stringify(event, null, 2));

        const response = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: event,
        });

        console.log('✅ Event added to calendar');
        return response.data;

    } catch (error) {
        console.error('❌ Google Calendar integration failed:', error.message);
        console.log('⚠️ Continuing without calendar integration...');
        return null;
    }
}
// Create timestamped filename for recordings
function createTimestampedFileName() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `booking-session-${timestamp}`;
}

// Use these selectors in waitForCountdownToEnd instead of creating your own time logic
async function waitForCountdownToEnd(page) {
    console.log(`⏰ Waiting for countdown to reach ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST...`);

    while (true) {
        try {
            // Wait for countdown elements to appear
            await page.waitForSelector(hr, { timeout: 10000 });
            await page.waitForSelector(min, { timeout: 10000 });
            await page.waitForSelector(sec, { timeout: 10000 });

            // Get countdown values from the page
            const [hourStr, minStr, secStr] = await Promise.all([
                page.$eval(hr, el => el.textContent.trim()),
                page.$eval(min, el => el.textContent.trim()),
                page.$eval(sec, el => el.textContent.trim())
            ]);

            const hours = parseInt(hourStr, 10) || 0;
            const minutes = parseInt(minStr, 10) || 0;
            const seconds = parseInt(secStr, 10) || 0;

            console.log(`Time remaining: ${hours}:${minutes}:${seconds}`);

            // If countdown is zero, proceed
            if (hours === 0 && minutes === 0 && seconds === 0) {
                return true;
            }

        } catch (error) {
            console.log('⚠️ Error reading countdown:', error.message);
            await delay(1000);
        }
    }
}

async function login(page, sessionName) {
    console.log('🔐 Attempting to login...');

    try {
        // Human-like navigation with realistic headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        });

        console.log('🌐 Navigating to login page...');
        await page.goto("https://app.playbypoint.com/users/sign_in", {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // Human-like page interaction - scroll a bit to mimic reading
        await page.waitForTimeout(1000 + Math.random() * 2000);
        await page.mouse.move(Math.random() * 100 + 100, Math.random() * 100 + 100);
        await page.waitForTimeout(500 + Math.random() * 1000);

        console.log('📄 Login page loaded');

        // Take screenshot for debugging


        // Check if we got blocked
        const pageContent = await page.content();
        if (pageContent.includes('403 Forbidden') || pageContent.includes('Access Denied') || pageContent.includes('<html><head></head><body></body></html>')) {
            throw new Error('403 Forbidden - Website is blocking automated access');
        }

        // Multiple selector strategies for email field
        const emailSelectors = [
            'input[name="user[email]"]',
            'input[type="email"]',
            '#user_email',
            'input[id="user_email"]',
            'input[placeholder*="email" i]'
        ];

        let emailFilled = false;
        for (const selector of emailSelectors) {
            try {
                console.log(`📧 Trying email selector: ${selector}`);
                await page.waitForSelector(selector, { timeout: 10000 });

                // Human-like interaction with realistic typing
                await page.click(selector);
                await page.waitForTimeout(200 + Math.random() * 300);

                // Type slowly like a human
                await page.type(selector, email, { delay: 50 + Math.random() * 100 });

                console.log(`✅ Email filled using: ${selector}`);
                emailFilled = true;
                break;
            } catch (e) {
                console.log(`⚠️ Email selector ${selector} failed: ${e.message}`);
                continue;
            }
        }

        if (!emailFilled) {
            const title = await page.title();
            const url = await page.url();
            console.log(`📋 Page title: ${title}`);
            console.log(`🔗 Current URL: ${url}`);
            console.log(`📝 Page content preview: ${pageContent.substring(0, 500)}`);
            throw new Error('❌ Could not find email input field with any selector');
        }

        // Human-like pause between fields
        await page.waitForTimeout(300 + Math.random() * 700);

        // Multiple selector strategies for password field
        const passwordSelectors = [
            'input[name="user[password]"]',
            'input[type="password"]',
            '#user_password',
            'input[id="user_password"]'
        ];

        let passwordFilled = false;
        for (const selector of passwordSelectors) {
            try {
                console.log(`🔒 Trying password selector: ${selector}`);
                await page.waitForSelector(selector, { timeout: 5000 });

                // Human-like interaction
                await page.click(selector);
                await page.waitForTimeout(200 + Math.random() * 300);

                // Type slowly like a human
                await page.type(selector, password, { delay: 50 + Math.random() * 100 });

                console.log(`✅ Password filled using: ${selector}`);
                passwordFilled = true;
                break;
            } catch (e) {
                console.log(`⚠️ Password selector ${selector} failed: ${e.message}`);
                continue;
            }
        }

        if (!passwordFilled) {
            throw new Error('❌ Could not find password input field with any selector');
        }

        // Human-like delay before clicking submit (people often pause to check their input)
        await page.waitForTimeout(800 + Math.random() * 1200);

        // Multiple selector strategies for login button
        const loginSelectors = [
            'input[type="submit"][name="commit"][value="Log in"]',
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Log in")',
            'button:has-text("Sign in")',
            '*[type="submit"]'
        ];

        let loginSuccess = false;
        for (const selector of loginSelectors) {
            try {
                console.log(`🔘 Trying login selector: ${selector}`);
                await page.waitForSelector(selector, { timeout: 3000 });

                // Human-like click with slight mouse movement
                const button = page.locator(selector).first();
                const box = await button.boundingBox();
                if (box) {
                    await page.mouse.move(
                        box.x + box.width / 2 + (Math.random() - 0.5) * 10,
                        box.y + box.height / 2 + (Math.random() - 0.5) * 10
                    );
                    await page.waitForTimeout(100 + Math.random() * 200);
                }

                await Promise.all([
                    page.waitForNavigation({
                        waitUntil: 'domcontentloaded',
                        timeout: 45000
                    }),
                    page.click(selector)
                ]);

                console.log(`✅ Login successful using: ${selector}`);
                loginSuccess = true;
                break;
            } catch (e) {
                console.log(`⚠️ Login selector ${selector} failed: ${e.message}`);
                continue;
            }
        }

        if (!loginSuccess) {
            throw new Error('❌ Could not find or click login button');
        }

        console.log('✅ Logged in successfully');

    } catch (error) {
        console.error('❌ Login failed:', error.message);

        try {

            const content = await page.content();
            console.log('📝 Page content preview:', content.substring(0, 1000));
        } catch (screenshotErr) {
            console.error('❌ Could not take debug screenshot:', screenshotErr.message);
        }

        throw error;
    }
}

async function goToBookingPage(page, sessionName) {
    console.log('🏟️ Navigating to booking page...');

    try {
        const selector = `a.ui.button.large.fluid.white[href="${BOOKING_URL}"]`;
        await page.waitForSelector(selector, { timeout: 15000 });

        // Human-like click with mouse movement
        const link = page.locator(selector);
        const box = await link.boundingBox();
        if (box) {
            await page.mouse.move(
                box.x + box.width / 2 + (Math.random() - 0.5) * 20,
                box.y + box.height / 2 + (Math.random() - 0.5) * 10
            );
            await page.waitForTimeout(200 + Math.random() * 300);
        }

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            page.click(selector)
        ]);



        console.log('✅ Navigated to booking page');
    } catch (error) {
        console.error('❌ Failed to navigate to booking page:', error.message);

        throw error;
    }
}

function getTargetDateInfo() {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 7);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[targetDate.getDay()];
    const dayNumber = String(targetDate.getDate()).padStart(2, '0');

    console.log(`📅 Target date: ${dayName} ${dayNumber} (7 days from today)`);
    return { dayName, dayNumber };
}

async function selectTargetDate(page, sessionName) {
    console.log('📅 Selecting target date...');

    try {
        const { dayName, dayNumber } = getTargetDateInfo();
        const dayButtons = await page.$$('.day-container button');

        console.log(`Found ${dayButtons.length} date buttons`);

        for (const btn of dayButtons) {
            const nameEl = await btn.$('.day_name');
            const numberEl = await btn.$('.day_number');
            if (nameEl && numberEl) {
                const name = (await nameEl.textContent()).trim();
                const number = (await numberEl.textContent()).trim();


                if (name === dayName && number === dayNumber) {
                    await btn.click();
                    console.log(`✅ Selected date: ${dayName} ${dayNumber}`);


                    return;
                }
            }
        }
        throw new Error(`❌ Could not find date: ${dayName} ${dayNumber}`);
    } catch (error) {
        console.error('❌ Date selection failed:', error.message);

        throw error;
    }
}

async function selectCourtType(page, sessionName) {
    console.log('🎾 Selecting court type...');

    try {
        const courtButton = await page.locator(`button:has-text("${COURT_TYPE}")`).first();
        await courtButton.waitFor({ timeout: 10000 });

        if (await courtButton.isVisible() && await courtButton.isEnabled()) {
            // Human-like delay and click
            await page.waitForTimeout(400 + Math.random() * 600);
            await courtButton.click();
            console.log(`✅ Selected court type: ${COURT_TYPE}`);


        } else {
            throw new Error(`❌ Court type button not available: ${COURT_TYPE}`);
        }
    } catch (error) {
        console.error('❌ Court type selection failed:', error.message);

        throw error;
    }
}

async function selectTimeSlots(page, sessionName) {
    console.log('🕒 Starting time slot selection...');


    let counter = 0;
    let i = 0;
    while (counter < TIME_SLOTS.length) {
        const time = TIME_SLOTS[i];
        const btn = page.locator(`button:has-text("${time}")`).first();
        try {
            const isVisible = await btn.isVisible();
            if (isVisible) {
                await btn.click();
                counter++;
                i++;
                console.log(`✅ Selected time slot: ${time} (${counter}/${TIME_SLOTS.length})`);
            } else {
                continue;
            }
        } catch (err) {
            console.log(`❌ Error selecting time slot "${time}": ${err.message}`);
        }
    }


    console.log('⚡ Time slot selection complete');
}
async function selectCourtsByPriority(page, sessionName) {
    console.log('🏟️ Selecting ONE court by priority...');


    try {
        // Wait for courts to be available
        await page.waitForTimeout(500);


        // Iterate through courts by priority (0 = highest priority)
        while (courtPriorityMap.size > 0) {
            // Get the lowest priority key (smallest number)
            const priorities = Array.from(courtPriorityMap.keys()).sort((a, b) => a - b);
            if (priorities.length === 0) break;
            const priority = priorities[0];
            const courtName = courtPriorityMap.get(priority);

            try {
                // Multiple selector strategies for court buttons
                const courtSelectors = [
                    `button:has-text("${courtName}")`,
                    `button[title*="${courtName}"]`,
                    `button:contains("${courtName}")`,
                    `*:has-text("${courtName}"):button`,
                    `.court-button:has-text("${courtName}")`,
                    `[data-court*="${courtName.toLowerCase()}"]`
                ];

                let courtSelected = false;

                for (const selector of courtSelectors) {
                    try {
                        const courtButton = page.locator(selector).first();

                        // Check if button exists and is visible
                        const isVisible = await courtButton.isVisible();

                        if (isVisible) {
                            const isEnabled = await courtButton.isEnabled();
                            const isSelected = await courtButton.getAttribute('class') || '';;

                            // Check if court is available (not already selected or disabled)
                            if (isEnabled && !isSelected.includes('selected') && !isSelected.includes('disabled')) {
                                // Human-like click with small delay
                                await courtButton.click();
                                console.log(`✅ Successfully selected ${courtName}`);
                                selectedCourt = courtName;
                                courtSelected = true;

                                // Remove the selected court from the map
                                for (const [key, value] of courtPriorityMap.entries()) {
                                    if (value === courtName) {
                                        courtPriorityMap.delete(key);
                                        break;
                                    }
                                }
                                // Exit immediately after selecting one court
                                break;
                            } else {
                                console.log(`⚠️ ${courtName} not available`);
                            }
                        }
                    } catch (selectorError) {
                        // Continue to next selector
                        continue;
                    }
                }

                // If we successfully selected a court, exit the priority loop
                if (courtSelected) {
                    console.log(`🎯 Court selection complete - Selected: ${courtName}`);
                    break;
                }

                if (!courtSelected) {
                    console.log(`   ❌ ${courtName} not found.`);
                    // Remove the court from the map if not found
                    for (const [key, value] of courtPriorityMap.entries()) {
                        if (value === courtName) {
                            courtPriorityMap.delete(key);
                            break;
                        }
                    }
                }

            } catch (courtError) {
                console.log(`   ❌ Error with ${courtName}: ${courtError.message}`);
                continue;
            }
        }

        // Summary of selected court
        if (selectedCourt) {
            console.log(`🎉 Successfully selected court: ${selectedCourt}`);
        } else {
            console.log('❌ No courts were available');
            throw err;
        }

        return selectedCourt; // Return single court name or null

    } catch (error) {
        console.error('❌ Court selection failed:', error.message);
        throw error;
    }
}
async function clickNext(page, sessionName) {

    try {
        const next = page.locator('button:has-text("Next")').first();

        if (await next.isVisible() && await next.isEnabled()) {
            await next.click();
        } else {
            throw new Error('❌ NEXT button not found');
        }
    } catch (error) {
        console.error('❌ Next button click failed:', error.message);

        throw error;
    }
}

async function clickAddButton(page) {
    console.log('🔘 Looking for ADD button...');

    try {
        const selectors = [
            'button.ui.button.mini.primary.basic.flex_align_items_center:has-text("Add")',
            'button.ui.button.mini.primary:has-text("Add")',
            'button.ui.button:has-text("Add")',
            'button:has-text("Add")'
        ];

        for (const selector of selectors) {
            try {
                const addBtn = page.locator(selector).first();

                if (await addBtn.isVisible() && await addBtn.isEnabled()) {
                    await addBtn.click();
                    return true;
                }
            } catch (selectorError) {
                console.log(`⚠️ Selector ${selector} not found, trying next...`);
                continue;
            }
        }

        console.error('❌ ADD button not found with any selector');
        return false;

    } catch (error) {
        console.error('❌ Error clicking ADD button:', error.message);
        return false;
    }
}

async function clickCheckout(page, sessionName) {

    try {
        const selectors = [
            'td:has(h2.mb0.stepper_title:text("Checkout"))',
            'h2.mb0.stepper_title:text("Checkout")',
            'h2:has-text("Checkout")',
            '*:has-text("Checkout")'
        ];

        for (const selector of selectors) {
            try {

                const checkoutBtn = page.locator(selector).first();

                if (await checkoutBtn.isVisible()) {
                    await checkoutBtn.click();
                    return true;
                }
            } catch (selectorError) {
                console.log(`⚠️ Selector ${selector} not found, trying next...`);
                continue;
            }
        }

        console.error('❌ Checkout button not found with any selector');
        return false;

    } catch (error) {
        console.error('❌ Error clicking Checkout button:', error.message);
        return false;
    }
}

async function addUsers(page, sessionName) {
    console.log('👥 Adding users...');

    try {
        const addUsersBtn = page.locator('button:has-text("ADD USERS")').first();
        await addUsersBtn.waitFor({ timeout: 10000 });

        if (await addUsersBtn.isVisible() && await addUsersBtn.isEnabled()) {
            await addUsersBtn.click();
            const addButtonClicked = await clickAddButton(page);

            if (addButtonClicked) {
                return true;
            } else {
                console.error('❌ Failed to click ADD button');
                return false;
            }

        } else {
            console.error('❌ ADD USERS button not found');
            return false;
        }

    } catch (error) {
        console.error('❌ Error adding users:', error.message);

        return false;
    }
}

async function clickBook(page, sessionName) {

    try {
        const exactSelector = 'button.ui.button.primary.fluid.large';

        const bookBtn = page.locator(exactSelector).first();

        if (await bookBtn.isVisible() && await bookBtn.isEnabled()) {
            const buttonText = await bookBtn.textContent();
            if (buttonText && buttonText.trim().toLowerCase().includes('book')) {
                await bookBtn.click();
                return true;
            } else {
                console.error('❌ Button found but does not contain "Book" text');
                return false;
            }
        } else {
            console.error('❌ Book button not visible or disabled');
            return false;
        }

    } catch (error) {
        console.error('❌ Error clicking Book button:', error.message);

        return false;
    }
}

async function clickSelectDateAndTime(page, sessionName) {

    try {
        const selectors = [
            'h2.mb0.stepper_title:has-text("Select date and time")',
            'h2:has-text("Select date and time")',
            '.stepper_title:has-text("Select date and time")',
            '*:has-text("Select date and time")',
            'h2.stepper_title:contains("Select date and time")',
            '[class*="stepper"]:has-text("Select date and time")'
        ];

        for (const selector of selectors) {
            try {

                const stepButton = page.locator(selector).first();

                // Check if element exists and is visible
                const isVisible = await stepButton.isVisible();

                if (isVisible) {
                    await stepButton.click();
                    // Wait for any navigation or page updates
                    await page.waitForTimeout(1000);

                    return true;
                } else {
                    console.log(`   ⚠️ "Select date and time" not visible with selector: ${selector}`);
                }
            } catch (selectorError) {
                console.log(`   ⚠️ Selector ${selector} failed: ${selectorError.message}`);
                continue;
            }
        }

        console.error('❌ "Select date and time" button not found with any selector');

        // Take debug screenshot


        // Log available stepper elements for debugging
        console.log('🔍 Looking for any stepper-related elements...');
        const stepperElements = await page.$$('[class*="stepper"], h2, .mb0');
        for (let i = 0; i < Math.min(stepperElements.length, 10); i++) {
            try {
                const elementText = await stepperElements[i].textContent();
                const elementClass = await stepperElements[i].getAttribute('class');
                console.log(`   Stepper element ${i + 1}: "${elementText?.trim() || 'No text'}" (class: ${elementClass})`);
            } catch (e) {
                console.log(`   Stepper element ${i + 1}: Error reading properties`);
            }
        }

        return false;

    } catch (error) {
        console.error('❌ Error clicking "Select date and time":', error.message);



        return false;
    }
}

async function run() {
    console.time('⏱️ Total time');
    console.log('🚀 bot starts running at', new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    console.log(`🎯 Bot configured for booking at ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST`);

    const sessionName = createTimestampedFileName();

    // Create recordings directory
    try {
        await mkdir('./recordings', { recursive: true });
        console.log('📁 Created recordings directory');
    } catch (err) {
        if (err.code !== 'EEXIST') {
            console.error('❌ Failed to create recordings directory:', err.message);
        }
    }

    // Advanced stealth browser configuration
    const browser = await chromium.launch({
        headless: process.env.NODE_ENV === 'production', // Visible in dev, headless in production
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-field-trial-config',
            '--disable-hang-monitor',
            '--disable-ipc-flooding-protection',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--force-color-profile=srgb',
            '--metrics-recording-only',
            '--no-crash-upload',
            '--no-pings',
            '--password-store=basic',
            '--use-mock-keychain',
            '--hide-scrollbars',
            '--mute-audio',
            `--user-agent=${STEALTH_CONFIG.userAgent}`
        ]
    });

    // Create stealth context with VIDEO RECORDING
    const context = await browser.newContext({
        userAgent: STEALTH_CONFIG.userAgent,
        viewport: STEALTH_CONFIG.viewport,
        locale: STEALTH_CONFIG.locale,
        timezoneId: STEALTH_CONFIG.timezone,
        permissions: STEALTH_CONFIG.permissions,
        geolocation: STEALTH_CONFIG.geolocation,
        colorScheme: 'light',
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
        },
        // 🎬 VIDEO RECORDING
        recordVideo: {
            dir: './recordings/',
            size: { width: 1440, height: 900 }
        }
    });

    const page = await context.newPage();

    // Take initial screenshot


    // Advanced stealth JavaScript injection
    await page.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Remove automation indicators
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;

        // Override navigator properties
        Object.defineProperty(navigator, 'userAgent', {
            get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        });

        Object.defineProperty(navigator, 'platform', {
            get: () => 'MacIntel',
        });

        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    0: {
                        type: 'application/x-google-chrome-pdf',
                        suffixes: 'pdf',
                        description: 'Portable Document Format',
                        enabledPlugin: null
                    },
                    description: 'Portable Document Format',
                    filename: 'internal-pdf-viewer',
                    length: 1,
                    name: 'Chrome PDF Plugin'
                }
            ],
        });

        // Mock realistic screen properties
        Object.defineProperty(screen, 'width', {
            get: () => 1440,
        });
        Object.defineProperty(screen, 'height', {
            get: () => 900,
        });
        Object.defineProperty(screen, 'availWidth', {
            get: () => 1440,
        });
        Object.defineProperty(screen, 'availHeight', {
            get: () => 877,
        });

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Add realistic WebGL properties
        const getParameter = WebGLRenderingContext.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris Pro OpenGL Engine';
            }
            return getParameter(parameter);
        };
    });

    try {
        console.log('🚀 Phase 1: Setting up booking...');
        console.log(`Start booking for ${USER_NAME}`);
        await login(page, sessionName);
        await goToBookingPage(page, sessionName);
        await page.waitForSelector('.day-container button', { timeout: 15000 });
        await selectTargetDate(page, sessionName);
        await selectCourtType(page, sessionName);

        console.log(`⏰ Phase 2: Waiting for ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST...`);
        await waitForCountdownToEnd(page);

        console.log('⚡ Phase 3: Lightning booking sequence!');
        const bookingStart = Date.now();
        const BOOKING_LOOP_TIMEOUT = 60 * 1000; // 60 seconds

        //listen for alert
        let alertAppeared = false;
        let lastDialogMessage = '';
        page.once('dialog', async dialog => {
            alertAppeared = true;
            lastDialogMessage = dialog.message();
            await dialog.accept();
        });


        let addUser = false;
        await selectTimeSlots(page, sessionName);
        // let confirmationCount = await page.locator("//div[text()='Confirmation Number']/following-sibling::div").count();;
        try {
            while (courtPriorityMap.size > 0) {
                // Check if we've exceeded the timeout
                if (Date.now() - bookingStart > BOOKING_LOOP_TIMEOUT) {
                    throw new Error('❌ Booking failed: Booking loop exceeded 60 seconds without success.');
                }

                // If alert appeared, log and continue loop
                if (alertAppeared) {
                    console.log(`⚠️ Alert appeared: ${lastDialogMessage}`);
                    alertAppeared = false; // reset for next iteration
                }
                // Select a different court by priority
                await selectCourtsByPriority(page, sessionName);
                // Click Next to proceed
                await clickNext(page, sessionName);
                if (!addUser) {
                    await addUsers(page, sessionName);
                    addUser = true;
                }
                // Go to checkout
                await clickCheckout(page, sessionName);
                // BOOK
                await clickBook(page, sessionName);
                await page.waitForTimeout(1000);

                await clickSelectDateAndTime(page, sessionName);
                continue;
            }
        } catch {
            console.log("Booking may have worked, checking for true error");
        }


        // After booking loop is complete and booking is confirmed
        const bookingTime = Date.now() - bookingStart;
        let confirmationNumber = await page.$eval("//div[text()='Confirmation Number']/following-sibling::div", el => el.textContent.trim());
        if (confirmationNumber) {
            console.log(`Booking confirmed! Here's the confirmation number: ${confirmationNumber?.trim()}`)
            console.log(`🏆 BOOKING COMPLETE! Total booking time: ${bookingTime}ms`);
            console.log('✅ Booking flow complete');
            const today = new Date();
            today.setDate(today.getDate() + 7);
            const formattedDate = today.toISOString().slice(0, 10); // YYYY-MM-DD

            // Parse the time slots to get start and end times
            const { startTime, endTime } = parseTimeSlots(TIME_SLOTS);

            // Convert to 24-hour format and create ISO strings
            const startHour = convertTo24Hour(startTime);
            const endHour = convertTo24Hour(endTime);

            const startDateTime = `${formattedDate}T${startHour}-07:00`;
            const endDateTime = `${formattedDate}T${endHour}-07:00`;

            console.log('🕐 Final start time:', startDateTime);
            console.log('🕐 Final end time:', endDateTime);

            await addCalendarEvent(startDateTime, endDateTime);
            await page.waitForTimeout(5000);
        }
        else {
            throw new Error('Booking failed: Confirmation number not found');
        }
    } catch (err) {
        console.error('❌ Booking failed:', err.message);

        throw err;
    } finally {
        await delay(10000);


        await context.close();
        await browser.close();

        console.timeEnd('⏱️ Total time');
    }
}

run().catch(console.error);
