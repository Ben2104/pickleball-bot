const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;

    try {
        // Step 1: Go to login page
        await page.goto('https://app.playbypoint.com/login');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);
        await page.click('button:has-text("Login")');
        await page.waitForNavigation();

        // Step 2: Go to booking page
        await page.goto('https://app.playbypoint.com/book/ipicklecerritos');
        await page.waitForSelector('text=Select date and time');

        // Step 3: Click desired date (e.g., SAT 02) — adjust as needed
        await page.click('button:has-text("SAT 02")');

        // Step 4: Select type Pickleball (if not already selected)
        const pickleballSelected = await page.isVisible('button.bg-green-600:has-text("PICKLEBALL")');
        if (!pickleballSelected) {
            await page.click('button:has-text("PICKLEBALL")');
        }

        // Step 5: Click time slots (7:00–7:30 AM and 7:30–8:00 AM)
        await page.click('button:has-text("7–7:30AM")');
        await page.click('button:has-text("7:30–8AM")');

        // Step 6: Click NEXT
        await page.click('button:has-text("NEXT")');

        console.log('✅ Court reserved successfully!');

    } catch (err) {
        console.error('❌ Error during booking:', err);
    } finally {
        await browser.close();
    }
})();
