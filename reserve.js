// playwright-booking-bot.js
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { mkdir } from 'fs/promises';
import {
    parseTimeSlots,
    convertTo24Hour,
    setupGoogleAuth,
    addCalendarEvent,
    createTimestampedFileName,
    waitForCountdownToEnd,
    login,
    goToBookingPage,
    getTargetDateInfo,
    getTimezoneOffset,
    selectTargetDate,
    selectCourtType,
    selectTimeSlots,
    selectCourtsByPriority,
    clickNext,
    clickAddButton,
    clickCheckout,
    addUsers,
    clickBook,
    clickSelectDateAndTime
} from './functions.js';
dotenv.config();

const email = process.env.EMAIL ? String(process.env.EMAIL).trim() : '';
const password = process.env.PASSWORD ? String(process.env.PASSWORD).trim() : '';
const USER_NAME = process.env.USER_NAME || 'Khoi Do'; // default to Khoi if there is no USER set

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
const { dayName, dayNumber } = getTargetDateInfo();
const todayAbbrev = dayName.toUpperCase().slice(0, 3);


// Example usage:
// const todayAbbrev = getDayAbbrev(); // e.g. "MON"
if (USER_NAME === 'Khoi Do') {
    if (todayAbbrev === 'SAT' || todayAbbrev === 'SUN') {
        TIME_SLOTS = ["6-6:30pm", "6:30-7pm", "7-7:30pm", "7:30-8pm"];
        courtPriorityMap = new Map([
            [1, "PICKLEBALL 2"],
            [0, "PICKLEBALL 4"],
            [2, "PICKLEBALL 6"],
            [3, "PICKLEBALL 9"],
            [4, "PICKLEBALL 3"],
            [5, "PICKLEBALL 8"],
            [6, "PICKLEBALL 7"],
            [7, "PICKLEBALL 1"],
            [8, "PICKLEBALL 5"],
            [9, "PICKLEBALL 10"],
        ]);
    }

    else {
        TIME_SLOTS = ["5:30-6pm", "6-6:30pm", "6:30-7pm", "7-7:30pm"];
        courtPriorityMap = new Map([
            [0, "PICKLEBALL 2"],
            [1, "PICKLEBALL 1"],
            [2, "PICKLEBALL 6"],
            [3, "PICKLEBALL 8"],
            [4, "PICKLEBALL 9"],
            [5, "PICKLEBALL 6"],
            [6, "PICKLEBALL 7"],
            [7, "PICKLEBALL 1"],
            [8, "PICKLEBALL 5"],
            [9, "PICKLEBALL 10"],
        ]);
    }

}
else if (USER_NAME === 'Marvin') {
    if (todayAbbrev === 'SAT' || todayAbbrev === 'SUN') {
        TIME_SLOTS = ["7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm"];
        courtPriorityMap = new Map([
            [0, "PICKLEBALL 1"],
            [1, "PICKLEBALL 8"],
            [2, "PICKLEBALL 3"],
            [3, "PICKLEBALL 9"],
            [4, "PICKLEBALL 5"],
            [5, "PICKLEBALL 6"],
            [6, "PICKLEBALL 7"],
            [7, "PICKLEBALL 10"],
            [8, "PICKLEBALL 2"],
            [9, "PICKLEBALL 4"],
        ]);
    }
    TIME_SLOTS = ["7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm"];
    courtPriorityMap = new Map([
        [1, "PICKLEBALL 2"],
        [0, "PICKLEBALL 4"],
        [2, "PICKLEBALL 6"],
        [3, "PICKLEBALL 9"],
        [4, "PICKLEBALL 3"],
        [5, "PICKLEBALL 8"],
        [6, "PICKLEBALL 7"],
        [7, "PICKLEBALL 1"],
        [8, "PICKLEBALL 5"],
        [9, "PICKLEBALL 10"],
    ]);
}
else if (USER_NAME === 'Elbert') {
    if (todayAbbrev === 'SAT' || todayAbbrev === 'SUN') {
        TIME_SLOTS = ["8-8:30pm", "8:30-9pm", "9-9:30pm", "9:30-10pm"];
        courtPriorityMap = new Map([
            [0, "PICKLEBALL 3"],
            [1, "PICKLEBALL 1"],
            [2, "PICKLEBALL 9"],
            [3, "PICKLEBALL 6"],
            [4, "PICKLEBALL 5"],
            [5, "PICKLEBALL 7"],
            [6, "PICKLEBALL 8"],
            [7, "PICKLEBALL 2"],
            [8, "PICKLEBALL 4"],
            [9, "PICKLEBALL 10"],
        ]);
    }
    else {
        TIME_SLOTS = ["5:30-6pm", "6-6:30pm", "6:30-7pm", "7-7:30pm"];
        courtPriorityMap = new Map([
            [0, "PICKLEBALL 3"],
            [1, "PICKLEBALL 1"],
            [2, "PICKLEBALL 9"],
            [3, "PICKLEBALL 6"],
            [4, "PICKLEBALL 5"],
            [5, "PICKLEBALL 7"],
            [6, "PICKLEBALL 8"],
            [7, "PICKLEBALL 2"],
            [8, "PICKLEBALL 4"],
            [9, "PICKLEBALL 10"],
        ]);
    }
}
else if (USER_NAME === 'Patrick') {
    TIME_SLOTS = ["7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm"];
    courtPriorityMap = new Map([
        [0, "PICKLEBALL 1"],
        [1, "PICKLEBALL 8"],
        [2, "PICKLEBALL 3"],
        [3, "PICKLEBALL 9"],
        [4, "PICKLEBALL 5"],
        [5, "PICKLEBALL 6"],
        [6, "PICKLEBALL 7"],
        [7, "PICKLEBALL 10"],
        [8, "PICKLEBALL 2"],
        [9, "PICKLEBALL 4"],
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

// Set up Google Calendar authentication
const { auth, calendar } = setupGoogleAuth();

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
        console.log(`Start booking for ${USER_NAME}`);
        const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const now = new Date();
        const dayName = weekdays[now.getDay()];
        console.log(`Today: ${dayName}`);
        await login(page, sessionName, email, password);
        await goToBookingPage(page, sessionName, BOOKING_URL);
        await page.waitForSelector('.day-container button', { timeout: 15000 });
        await selectTargetDate(page, sessionName);
        await selectCourtType(page, sessionName, COURT_TYPE);
        for (const value of courtPriorityMap.values()) {
            console.log(value);
        }


        await waitForCountdownToEnd(page);


        const bookingStart = Date.now();


        //listen for alert
        let alertAppeared = false;
        let lastDialogMessage = '';
        page.once('dialog', async dialog => {
            alertAppeared = true;
            lastDialogMessage = dialog.message();
            await dialog.accept();
        });


        let addUser = false;
        let click_next = false
        let book_clicked = false;
        await selectTimeSlots(page, sessionName, TIME_SLOTS);
        // let confirmationCount = await page.locator("//div[text()='Confirmation Number']/following-sibling::div").count();;
        try {
            while (courtPriorityMap.size > 0) {
                // If alert appeared, log and continue loop
                if (alertAppeared) {
                    console.log(`⚠️ Alert appeared: ${lastDialogMessage}`);
                    alertAppeared = false; // reset for next iteration
                }
                // Select a different court by priority
                selectedCourt = await selectCourtsByPriority(page, sessionName, courtPriorityMap);
                // Click Next to proceed
                if (!click_next) {
                    await clickNext(page, sessionName);
                    click_next = true;
                }
                if (!addUser) {
                    await addUsers(page, sessionName);
                    addUser = true;
                }
                // Go to checkout
                await clickCheckout(page, sessionName);
                // BOOK
                const bookResult = await clickBook(page, sessionName, book_clicked);
                if (bookResult) book_clicked = true;
                await page.waitForTimeout(1000);

                await clickSelectDateAndTime(page, sessionName);
                continue;
            }
        } catch {
            console.log("Booking may have worked, checking for true error");
        }


        // After booking loop is complete and booking is confirmed
        const bookingTime = Date.now() - bookingStart;
        let confirmationNumber = await page.$eval("//div[text()='Confirmation Number']/following-sibling::div", el => el.textContent.trim()).catch(() => null);

        if (!confirmationNumber) {
            await page.waitForSelector("//div[text()='Confirmation Number']/following-sibling::div", { timeout: 5000 });
            confirmationNumber = await page.$eval("//div[text()='Confirmation Number']/following-sibling::div", el => el.textContent.trim());
        }
        // Selector for the confirmation court info element
        let courtInfoSelector = await page.$eval("//div[contains(text(),'Pickleball') and contains(text(),'Court')]", el => el.textContent.trim());

        if (confirmationNumber) {
            console.log(`Booking confirmed! Here's the confirmation number: ${confirmationNumber?.trim()}`)
            console.log(`Court info: ${courtInfoSelector?.trim()}`);
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

            // Get the correct timezone offset for the booking date (accounts for DST)
            const timezoneOffset = getTimezoneOffset(today);

            const startDateTime = `${formattedDate}T${startHour}${timezoneOffset}`;
            const endDateTime = `${formattedDate}T${endHour}${timezoneOffset}`;

            console.log('🕐 Final start time:', startDateTime);
            console.log('🕐 Final end time:', endDateTime);

            await addCalendarEvent(auth, calendar, startDateTime, endDateTime, courtInfoSelector, USER_NAME, CALENDAR_ID)
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
