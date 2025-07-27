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
const TIME_SLOTS = ["8-8:30pm", "8:30-9pm", "9-9:30pm", "9:30-10pm"];

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

async function waitForCountdownToEnd(page) {
    console.log(`⏰ Waiting for countdown to reach ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST...`);

    while (true) {
        try {
            const now = new Date();
            const pstTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
            const currentHour = pstTime.getHours();
            const currentMinute = pstTime.getMinutes();
            const currentSecond = pstTime.getSeconds();

            const targetTime = new Date(pstTime);
            targetTime.setHours(BOOKING_HOUR, BOOKING_MINUTE, 0, 0);

            if (pstTime >= targetTime) {
                targetTime.setDate(targetTime.getDate() + 1);
            }

            const timeUntilTarget = targetTime - pstTime;

            if (timeUntilTarget <= 5000 && timeUntilTarget >= 0) {
                console.log(`✅ ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST reached! Starting booking...`);
                return true;
            }

            const totalSeconds = Math.floor(timeUntilTarget / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            console.log(`⏳ Current PST: ${currentHour}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')} - Time until ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')}: ${hours}h ${minutes}m ${seconds}s`);

            if (timeUntilTarget > 23 * 60 * 60 * 1000) {
                console.log('⚠️ Booking time is more than 23 hours away. Check your BOOKING_HOUR setting.');
            }

            try {
                const timeSlotButton = await page.locator(`button:has-text("${TIME_SLOTS[0]}")`).isVisible({ timeout: 1000 });
                if (timeSlotButton && timeUntilTarget <= 5000) {
                    console.log('✅ Time slot buttons are now available! Starting booking...');
                    return true;
                }
            } catch (e) {
                // Ignore timeout errors when checking for buttons
            }

            await delay(1000);

        } catch (error) {
            console.log('⚠️ Error checking time:', error.message);
            await delay(1000);
        }
    }
}

async function login(page) {
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
        await page.screenshot({ path: 'login-page-debug.png' });
        
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
            await page.screenshot({ path: 'login-error-full.png', fullPage: true });
            const content = await page.content();
            console.log('📝 Page content preview:', content.substring(0, 1000));
        } catch (screenshotErr) {
            console.error('❌ Could not take debug screenshot:', screenshotErr.message);
        }
        
        throw error;
    }
}

async function goToBookingPage(page) {
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
        await page.screenshot({ path: 'booking-page-error.png' });
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

async function selectTargetDate(page) {
    console.log('📅 Selecting target date...');
    
    try {
        const { dayName, dayNumber } = getTargetDateInfo();
        const dayButtons = await page.$$('.day-container button');

        for (const btn of dayButtons) {
            const nameEl = await btn.$('.day_name');
            const numberEl = await btn.$('.day_number');
            if (nameEl && numberEl) {
                const name = (await nameEl.textContent()).trim();
                const number = (await numberEl.textContent()).trim();

                console.log(`Found date button: ${name} ${number}`);

                if (name === dayName && number === dayNumber) {
                    // Human-like click with delay
                    await page.waitForTimeout(300 + Math.random() * 500);
                    await btn.click();
                    console.log(`✅ Selected date: ${dayName} ${dayNumber}`);
                    return;
                }
            }
        }
        throw new Error(`❌ Could not find date: ${dayName} ${dayNumber}`);
    } catch (error) {
        console.error('❌ Date selection failed:', error.message);
        await page.screenshot({ path: 'date-selection-error.png' });
        throw error;
    }
}

async function selectCourtType(page) {
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
        await page.screenshot({ path: 'court-type-error.png' });
        throw error;
    }
}

async function selectTimeSlots(page) {
    console.log('🕒 Starting time slot selection...');

    await page.waitForTimeout(2000);

    for (const time of TIME_SLOTS) {
        console.log(`🎯 Attempting to select: ${time}`);
        const btn = page.locator(`button:has-text("${time}")`).first();

        try {
            await btn.waitFor({ timeout: 3000 });
            const isVisible = await btn.isVisible();
            const isEnabled = await btn.isEnabled();

            console.log(`   Button status - Visible: ${isVisible}, Enabled: ${isEnabled}`);

            if (isVisible && isEnabled) {
                // Human-like delay between clicks
                await page.waitForTimeout(100 + Math.random() * 200);
                await btn.click({ timeout: 1000 });
                console.log(`✅ Selected time slot: ${time}`);
                await page.waitForTimeout(150 + Math.random() * 250);
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
    console.log('⏭️ Clicking Next...');
    
    try {
        const next = page.locator('button:has-text("Next")').first();
        await next.waitFor({ timeout: 10000 });
        
        if (await next.isVisible() && await next.isEnabled()) {
            // Human-like delay before clicking
            await page.waitForTimeout(300 + Math.random() * 500);
            await next.click();
            console.log('✅ Clicked NEXT');
        } else {
            throw new Error('❌ NEXT button not found');
        }
    } catch (error) {
        console.error('❌ Next button click failed:', error.message);
        await page.screenshot({ path: 'next-button-error.png' });
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
                await page.waitForSelector(selector, { timeout: 2000 });
                const addBtn = page.locator(selector).first();

                if (await addBtn.isVisible() && await addBtn.isEnabled()) {
                    await page.waitForTimeout(200 + Math.random() * 300);
                    await addBtn.click();
                    console.log(`✅ Successfully clicked ADD button using: ${selector}`);
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
                    await page.waitForTimeout(300 + Math.random() * 400);
                    await checkoutBtn.click();
                    console.log(`✅ Successfully clicked Checkout using: ${selector}`);
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

async function addUsers(page) {
    console.log('👥 Adding users...');

    try {
        const addUsersBtn = page.locator('button:has-text("ADD USERS")').first();
        await addUsersBtn.waitFor({ timeout: 10000 });

        if (await addUsersBtn.isVisible() && await addUsersBtn.isEnabled()) {
            await page.waitForTimeout(400 + Math.random() * 600);
            await addUsersBtn.click();
            console.log('✅ Clicked ADD USERS button');
            await page.waitForTimeout(200);

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
        await page.screenshot({ path: 'add-users-error.png' });
        return false;
    }
}

async function clickBook(page) {
    console.log('📋 Looking for Book button...');

    try {
        const exactSelector = 'button.ui.button.primary.fluid.large';
        await page.waitForSelector(exactSelector, { timeout: 5000 });

        const bookBtn = page.locator(exactSelector).first();

        if (await bookBtn.isVisible() && await bookBtn.isEnabled()) {
            const buttonText = await bookBtn.textContent();
            if (buttonText && buttonText.trim().toLowerCase().includes('book')) {
                // Human-like pause before final action
                await page.waitForTimeout(500 + Math.random() * 800);
                await bookBtn.click();
                console.log('🎉 Successfully clicked BOOK button - Booking Complete!');
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
        await page.screenshot({ path: 'book-button-error.png' });
        return false;
    }
}

async function run() {
    console.time('⏱️ Total time');
    console.log(`🎯 Bot configured for booking at ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST`);

    // Advanced stealth browser configuration
    const browser = await chromium.launch({
        headless: true,
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
            '--no-default-browser-check',
            '--no-pings',
            '--password-store=basic',
            '--use-mock-keychain',
            '--hide-scrollbars',
            '--mute-audio',
            `--user-agent=${STEALTH_CONFIG.userAgent}`
        ]
    });
    
    // Create stealth context with realistic settings
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
        }
    });
    
    const page = await context.newPage();
    
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
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
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
        await login(page);
        await goToBookingPage(page);
        await page.waitForSelector('.day-container button', { timeout: 15000 });
        await selectTargetDate(page);
        await selectCourtType(page);

        console.log(`⏰ Phase 2: Waiting for ${BOOKING_HOUR}:${BOOKING_MINUTE.toString().padStart(2, '0')} PST...`);
        await waitForCountdownToEnd(page);

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
        await page.screenshot({ path: 'final-error.png', fullPage: true });
        throw err;
    } finally {
        await delay(5000);
        await browser.close();
        console.timeEnd('⏱️ Total time');
    }
}

run().catch(console.error);