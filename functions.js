// functions.js - Utility and booking functions
import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';

/**
 * Parse time slots to extract start and end times
 */
export function parseTimeSlots(timeSlots) {
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

/**
 * Convert time string to 24-hour format
 */
export function convertTo24Hour(timeStr) {
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

/**
 * Set up Google Calendar authentication
 */
export function setupGoogleAuth() {
    let auth = null;
    let calendar = null;

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

    return { auth, calendar };
}

/**
 * Add event to Google Calendar
 */
export async function addCalendarEvent(auth, calendar, startDateTime, endDateTime, courtInfo, userName, calendarId) {
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
            summary: `🏓 ${userName}'s court,  court: ${courtInfo}`,
            location: 'iPickle Cerritos',
            description: `${userName}'s court,  court: ${courtInfo}`,
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
            calendarId: calendarId,
            resource: event,
        });

        console.log('✅ Event added to calendar');
        console.log('📅 Event link:', response.data.htmlLink);

        return response.data;

    } catch (error) {
        console.error('❌ Google Calendar integration failed:', error.message);
        console.log('⚠️ Continuing without calendar integration...');
        return null;
    }
}

/**
 * Create timestamped filename for recordings
 */
export function createTimestampedFileName() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `booking-session-${timestamp}`;
}

/**
 * Wait for countdown to end before booking opens
 */
export async function waitForCountdownToEnd(page) {
    // Define selectors for countdown and message
    await page.waitForTimeout(1000); // Initial wait to allow countdown to appear
    const selectors = {
        messageUntilOpen: "//div[contains(text(),'Booking for this day will open in')]",
        hr: "(//div[contains(@class,'Countdown')]//td)[1]",
        min: "(//div[contains(@class,'Countdown')]//td)[3]",
        sec: "(//div[contains(@class,'Countdown')]//td)[5]"
    };

    let count = await page.locator(selectors.messageUntilOpen).count();
    let loopCounter = 0;
    while (count > 0) {
        await page.waitForTimeout(200);
        count = await page.locator(selectors.messageUntilOpen).count();
        if (count < 1) {
            break;
        }
        try {
            const hourStr = await page.$eval(selectors.hr, el => el.textContent.trim());
            const minStr = await page.$eval(selectors.min, el => el.textContent.trim());
            const secStr = await page.$eval(selectors.sec, el => el.textContent.trim());
            if (loopCounter % 10 === 0) {
                console.log(`time left remaining: ${hourStr}:${minStr}:${secStr}`);
            }
        } catch (e) {
            // Ignore errors if countdown elements are not found
        }
        loopCounter++;
    }
    // Optionally log when countdown is done
    console.log('Countdown finished, proceeding to booking...');
}

/**
 * Login to the booking platform
 */
export async function login(page, sessionName, email, password) {
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

/**
 * Navigate to booking page
 */
export async function goToBookingPage(page, sessionName, bookingUrl) {
    console.log('🏟️ Navigating to booking page...');

    try {
        const selector = `a.ui.button.large.fluid.white[href="${bookingUrl}"]`;
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

/**
 * Get target date information (7 days from today)
 */
export function getTargetDateInfo() {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 7);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[targetDate.getDay()];
    const dayNumber = String(targetDate.getDate()).padStart(2, '0');

    console.log(`📅 Target date: ${dayName} ${dayNumber} (7 days from today)`);
    return { dayName, dayNumber };
}

/**
 * Get the timezone offset for a specific date in America/Los_Angeles timezone
 * Returns the offset string (e.g., '-07:00' for PDT or '-08:00' for PST)
 */
export function getTimezoneOffset(date) {
    // Create a date string in LA timezone
    const laDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    
    // Get offset in minutes
    const offsetMinutes = date.getTimezoneOffset() - laDate.getTimezoneOffset();
    
    // Alternatively, use a more reliable method:
    // Get the UTC time for a specific time in LA
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const laDateTime = {};
    parts.forEach(({ type, value }) => {
        laDateTime[type] = value;
    });
    
    // Create a UTC date and LA date to compare
    const utcTime = Date.UTC(
        parseInt(laDateTime.year),
        parseInt(laDateTime.month) - 1,
        parseInt(laDateTime.day),
        parseInt(laDateTime.hour),
        parseInt(laDateTime.minute),
        parseInt(laDateTime.second)
    );
    
    const offsetMs = utcTime - date.getTime();
    const offsetHours = Math.floor(Math.abs(offsetMs) / (1000 * 60 * 60));
    const offsetMins = Math.floor((Math.abs(offsetMs) % (1000 * 60 * 60)) / (1000 * 60));
    
    const sign = offsetMs >= 0 ? '+' : '-';
    const offset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
    
    console.log(`🕐 Timezone offset for ${date.toISOString()}: ${offset}`);
    return offset;
}

/**
 * Select target date on booking page
 */
export async function selectTargetDate(page, sessionName) {
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

/**
 * Select court type
 */
export async function selectCourtType(page, sessionName, courtType) {
    console.log('🎾 Selecting court type...');

    try {
        const courtButton = await page.locator(`button:has-text("${courtType}")`).first();
        await courtButton.waitFor({ timeout: 10000 });

        if (await courtButton.isVisible() && await courtButton.isEnabled()) {
            // Human-like delay and click
            await page.waitForTimeout(400 + Math.random() * 600);
            await courtButton.click();
            console.log(`✅ Selected court type: ${courtType}`);
        } else {
            throw new Error(`❌ Court type button not available: ${courtType}`);
        }
    } catch (error) {
        console.error('❌ Court type selection failed:', error.message);
        throw error;
    }
}

/**
 * Select time slots
 */
export async function selectTimeSlots(page, sessionName, timeSlots) {
    console.log('🕒 Starting time slot selection...');

    let counter = 0;
    let i = 0;
    while (counter < timeSlots.length) {
        const time = timeSlots[i];
        const btn = page.locator(`button:has-text("${time}")`).first();
        try {
            const isVisible = await btn.isVisible();
            if (isVisible) {
                // Check if button has 'red' in its class
                const className = await btn.getAttribute('class');
                if (className && className.includes('red')) {
                    console.log(`❌ Time slot "${time}" is unavailable. Aborting booking.`);
                    throw new Error(`Time slot "${time}" is unavailable`);
                }
                await btn.click();
                counter++;
                i++;
                console.log(`✅ Selected time slot: ${time} (${counter}/${timeSlots.length})`);
            } else {
                continue;
            }
        } catch (err) {
            console.log(`❌ Error selecting time slot "${time}": ${err.message}`);
            throw err; // break the program if error occurs
        }
    }

    console.log(' Time slot selection complete');
}

/**
 * Select courts by priority
 */
export async function selectCourtsByPriority(page, sessionName, courtPriorityMap) {
    try {
        await page.waitForTimeout(50); // Wait for courts to load

        let selectedCourt = null;

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
                            const isSelected = await courtButton.getAttribute('class') || '';

                            // Check if court is available (not already selected or disabled)
                            if (isEnabled && !isSelected.includes('selected') && !isSelected.includes('disabled')) {
                                await courtButton.click();
                                console.log(`✅ selected ${courtName}`);
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
                                console.log(` ${courtName} not available`);
                                // Remove the unavailable court from the map
                                for (const [key, value] of courtPriorityMap.entries()) {
                                    if (value === courtName) {
                                        courtPriorityMap.delete(key);
                                        break;
                                    }
                                }
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
        if (!selectedCourt) {
            console.log('❌ No courts were available');
            throw new Error('No courts available');
        }

        return selectedCourt; // Return single court name or null

    } catch (error) {
        console.error('❌ Court selection failed:', error.message);
        throw error;
    }
}

/**
 * Click Next button
 */
export async function clickNext(page, sessionName) {
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

/**
 * Click Add button
 */
export async function clickAddButton(page) {
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
                    await page.waitForTimeout(50);
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

/**
 * Click Checkout button
 */
export async function clickCheckout(page, sessionName) {
    try {
        const selectors = ["//h2[text()='Checkout']"];

        for (const selector of selectors) {
            try {
                const checkoutBtn = page.locator(selector).first();

                if (await checkoutBtn.isVisible()) {
                    await page.waitForTimeout(100);
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

/**
 * Add users to booking
 */
export async function addUsers(page, sessionName) {
    try {
        const addUsersBtn = page.locator('button:has-text("ADD USERS")').first();
        await addUsersBtn.waitFor({ timeout: 10000 });

        if (await addUsersBtn.isVisible() && await addUsersBtn.isEnabled()) {
            await page.waitForTimeout(100);
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

/**
 * Click Book button
 */
export async function clickBook(page, sessionName, bookClicked) {
    if (!bookClicked) {
        await page.waitForTimeout(500); // Wait for book buttons to appear for 500ms for the first time
    } else {
        await page.waitForTimeout(1000); // Wait for book buttons to appear 1000ms for subsequent attempts
    }
    try {
        const exactSelector = '//button[text()="Book"]';

        const bookBtn = page.locator(exactSelector);

        if (await bookBtn.isVisible() && await bookBtn.isEnabled()) {
            await bookBtn.click({ timeout: 5000 });
            return true;
        } else {
            console.error('❌ Book button not visible or disabled');
            return false;
        }

    } catch (error) {
        console.error('❌ Error clicking Book button:', error.message);
        return false;
    }
}

/**
 * Click Select date and time button
 */
export async function clickSelectDateAndTime(page, sessionName) {
    try {
        const selectors = ["//h2[text()='Select date and time']"];

        for (const selector of selectors) {
            try {
                const stepButton = page.locator(selector).first();

                // Check if element exists and is visible
                const isVisible = await stepButton.isVisible();

                if (isVisible) {
                    await stepButton.click();
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
        return false;

    } catch (error) {
        console.error('❌ Error clicking "Select date and time":', error.message);
        return false;
    }
}
