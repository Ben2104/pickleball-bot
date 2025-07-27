// playwright-booking-bot.js
import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

const email = process.env.EMAIL ? String(process.env.EMAIL).trim() : '';
const password = process.env.PASSWORD ? String(process.env.PASSWORD).trim() : '';


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
const TIME_SLOTS = ["8-8:30pm", "8:30-9pm", "9-9:30pm", "9:30-10pm"]; // Update as needed

// Configuration for testing - set your desired booking time here
const BOOKING_HOUR = parseInt(process.env.BOOKING_HOUR) || 7; // Convert to number
const BOOKING_MINUTE = parseInt(process.env.BOOKING_MINUTE) || 0; // Convert to number
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function waitForCountdownToEnd(page) {
    console.log(`⏰ Waiting for countdown to reach ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST...`);

    while (true) {
        try {
            // Get current time in PST
            const now = new Date();
            const pstTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
            const currentHour = pstTime.getHours();
            const currentMinute = pstTime.getMinutes();
            const currentSecond = pstTime.getSeconds();
            
            // Create target time for today
            const targetTime = new Date(pstTime);
            targetTime.setHours(BOOKING_HOUR, BOOKING_MINUTE, 0, 0);
            
            // If target time has passed today, set it for tomorrow
            if (pstTime >= targetTime) {
                targetTime.setDate(targetTime.getDate() + 1);
            }
            
            const timeUntilTarget = targetTime - pstTime;
            
            // Check if we've reached the exact target time (within 5 seconds)
            if (timeUntilTarget <= 5000 && timeUntilTarget >= 0) {
                console.log(`✅ ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST reached! Starting booking...`);
                return true;
            }
            
            // Calculate display time
            const totalSeconds = Math.floor(timeUntilTarget / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            console.log(`⏳ Current PST: ${currentHour}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')} - Time until ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')}: ${hours}h ${minutes}m ${seconds}s`);
            
            // For testing: if booking time is more than 23 hours away, something is wrong
            if (timeUntilTarget > 23 * 60 * 60 * 1000) {
                console.log('⚠️ Booking time is more than 23 hours away. Check your BOOKING_HOUR setting.');
            }
            
            // Backup condition - check if time slot buttons are available
            try {
                const timeSlotButton = await page.locator(`button:has-text("${TIME_SLOTS[0]}")`).isVisible({ timeout: 1000 });
                if (timeSlotButton && timeUntilTarget <= 5000) {
                    console.log('✅ Time slot buttons are now available! Starting booking...');
                    return true;
                }
            } catch (e) {
                // Ignore timeout errors when checking for buttons
            }

            // Wait 1 second before checking again
            await delay(1000);

        } catch (error) {
            console.log('⚠️ Error checking time:', error.message);
            await delay(1000);
        }
    }
}

async function login(page) {
    await page.goto("https://app.playbypoint.com/users/sign_in", { waitUntil: 'networkidle' });
    await page.fill('input[name="user[email]"]', email);
    await page.fill('input[name="user[password]"]', password);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click('input[type="submit"][name="commit"][value="Log in"]')
    ]);
    console.log('✅ Logged in successfully');
}

async function goToBookingPage(page) {
    const selector = `a.ui.button.large.fluid.white[href="${BOOKING_URL}"]`;
    await page.waitForSelector(selector);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click(selector)
    ]);
    console.log('✅ Navigated to booking page');
}

function getTargetDateInfo() {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 7); // 7 days ahead instead of 1

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[targetDate.getDay()];
    const dayNumber = String(targetDate.getDate()).padStart(2, '0');

    return { dayName, dayNumber };
}

async function selectTargetDate(page) {
    const { dayName, dayNumber } = getTargetDateInfo(); // Updated function name
    const dayButtons = await page.$$('.day-container button');


    for (const btn of dayButtons) {
        const nameEl = await btn.$('.day_name');
        const numberEl = await btn.$('.day_number');
        if (nameEl && numberEl) {
            const name = (await nameEl.textContent()).trim();
            const number = (await numberEl.textContent()).trim();

            console.log(`Found date button: ${name} ${number}`);

            if (name === dayName && number === dayNumber) {
                await btn.click();
                console.log(`✅ Selected date: ${dayName} ${dayNumber}`);
                return;
            }
        }
    }
    throw new Error(`❌ Could not find date: ${dayName} ${dayNumber}`);
}

async function selectCourtType(page) {
    const courtButton = await page.locator(`button:has-text("${COURT_TYPE}")`).first();
    if (await courtButton.isVisible() && await courtButton.isEnabled()) {
        await courtButton.click();
        console.log(`✅ Selected court type: ${COURT_TYPE}`);
    } else {
        throw new Error(`❌ Court type button not available: ${COURT_TYPE}`);
    }
}

async function selectTimeSlots(page) {
    console.log('🕒 Starting time slot selection...');

    // Wait a bit longer for time slots to load after countdown ends
    await page.waitForTimeout(2000);

    for (const time of TIME_SLOTS) {
        console.log(`🎯 Attempting to select: ${time}`);
        const btn = page.locator(`button:has-text("${time}")`).first();

        try {
            // Wait longer for the button to appear after countdown
            await btn.waitFor({ timeout: 3000 });
            const isVisible = await btn.isVisible();
            const isEnabled = await btn.isEnabled();

            console.log(`   Button status - Visible: ${isVisible}, Enabled: ${isEnabled}`);

            if (isVisible && isEnabled) {
                await btn.click({ timeout: 1000 });
                console.log(`✅ Selected time slot: ${time}`);

                // Small delay between clicks
                await page.waitForTimeout(100);
            } else {
                console.log(`❌ Not clickable: ${time}`);
            }
        } catch (err) {
            console.log(`❌ Not found or not clickable in time: ${time} - ${err.message}`);
        }
    }

    console.log('⚡ Time slot selection complete');
}

async function clickNext(page) {
    const next = page.locator('button:has-text("Next")').first();
    if (await next.isVisible() && await next.isEnabled()) {
        await next.click();
        console.log('✅ Clicked NEXT');
    } else {
        throw new Error('❌ NEXT button not found');
    }
}

async function clickAddButton(page) {
    console.log('🔘 Looking for ADD button...');

    try {
        // Multiple selectors to find the specific ADD button
        const selectors = [
            'button.ui.button.mini.primary.basic.flex_align_items_center:has-text("Add")',
            'button.ui.button.mini.primary:has-text("Add")',
            'button.ui.button:has-text("Add")',
            'button:has-text("Add")'
        ];

        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                const addBtn = page.locator(selector).first();

                if (await addBtn.isVisible() && await addBtn.isEnabled()) {
                    await addBtn.click();
                    console.log(`✅ Successfully clicked ADD button using: ${selector}`);

                    // Small wait for the action to complete
                    await page.waitForTimeout(230);

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

async function clickCheckout(page) {
    console.log('🛒 Looking for Checkout button...');

    try {
        // Multiple selector strategies
        const selectors = [
            'td:has(h2.mb0.stepper_title:text("Checkout"))',
            'h2.mb0.stepper_title:text("Checkout")',
            'h2:has-text("Checkout")',
            '*:has-text("Checkout")'
        ];

        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                const checkoutBtn = page.locator(selector).first();

                if (await checkoutBtn.isVisible()) {
                    await checkoutBtn.click();
                    console.log(`✅ Successfully clicked Checkout using: ${selector}`);

                    // Small wait for the action to complete
                    await page.waitForTimeout(500);

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

// Updated addUsers function using the new clickAddButton function
async function addUsers(page) {
    console.log('👥 Adding users...');

    try {
        // Step 1: Look for "ADD USERS" button
        const addUsersBtn = page.locator('button:has-text("ADD USERS")').first();

        if (await addUsersBtn.isVisible() && await addUsersBtn.isEnabled()) {
            await addUsersBtn.click();
            console.log('✅ Clicked ADD USERS button');

            // Wait for modal to open
            await page.waitForTimeout(200);

            // Step 2: Use the dedicated clickAddButton function
            const addButtonClicked = await clickAddButton(page);

            if (addButtonClicked) {
                console.log('✅ Users added successfully');
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

async function clickBook(page) {
    console.log('📋 Looking for Book button...');

    try {
        // Wait for the exact button structure
        const exactSelector = 'button.ui.button.primary.fluid.large';
        await page.waitForSelector(exactSelector, { timeout: 5000 });

        const bookBtn = page.locator(exactSelector).first();

        if (await bookBtn.isVisible() && await bookBtn.isEnabled()) {
            // Verify it contains "Book" text
            const buttonText = await bookBtn.textContent();
            if (buttonText && buttonText.trim().toLowerCase().includes('book')) {
                await bookBtn.click();
                console.log('🎉 Successfully clicked BOOK button - Booking Complete!');

                // Wait for booking confirmation
                await page.waitForTimeout(1000);

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

async function run() {
    console.time('⏱️ Total time');
    console.log(`🎯 Bot configured for booking at ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST`);
    
    const browser = await chromium.launch({
        headless: true, // 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    const page = await browser.newPage();

    try {
        // Phase 1: Setup (before countdown)
        console.log('🚀 Phase 1: Setting up booking...');
        await login(page);
        await goToBookingPage(page);
        await page.waitForSelector('.day-container button', { timeout: 10000 });
        await selectTargetDate(page);
        await selectCourtType(page);

        // Phase 2: Wait for countdown to end
        console.log(`⏰ Phase 2: Waiting for ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST...`);
        await waitForCountdownToEnd(page);
        
        // Phase 3: Lightning fast booking
        console.log('⚡ Phase 3: Lightning booking sequence!');
        const bookingStart = Date.now();

        await selectTimeSlots(page);
        await clickNext(page);
        await addUsers(page);
        await clickCheckout(page);
        await clickBook(page);

        const bookingTime = Date.now() - bookingStart;
        console.log(`🏆 BOOKING COMPLETE! Total booking time: ${bookingTime}ms`);
        console.log('✅ Booking flow complete');

    } catch (err) {
        console.error('❌ Booking failed:', err.message);
        await page.screenshot({ path: 'error.png' });
        throw err;
    } finally {
        await delay(5000);
        await browser.close();
        console.timeEnd('⏱️ Total time');
    }
}

run();