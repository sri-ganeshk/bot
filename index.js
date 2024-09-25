const express = require('express');
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = 3000;

app.get('/getAttendance', async (req, res) => {
  const { id, password } = req.query;

  if (!id || !password) {
    return res.status(400).send('Missing id or password');
  }

  try {
    // Launch the browser with chrome-aws-lambda
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Navigate to login page
    await page.goto('https://webprosindia.com/vignanit/Default.aspx', { waitUntil: 'networkidle0' });

    // Fill in id and password
    await page.evaluate(({ id, password }) => {
      document.getElementById('txtId2').value = id;
      const passField = document.getElementById('txtPwd2');
      passField.click();
      passField.focus();
      passField.value = password;

      const keyupEvent = new Event('keyup', { bubbles: true, cancelable: true });
      passField.dispatchEvent(keyupEvent);

      const blurEvent = new Event('blur', { bubbles: true, cancelable: true });
      passField.dispatchEvent(blurEvent);

      document.getElementById('imgBtn2').click();
    }, { id, password });

    // Wait for the login to complete and then navigate to the attendance page
    await page.waitForNavigation();
    await page.goto('https://webprosindia.com/vignanit/Academics/StudentAttendance.aspx?scrid=3&showtype=SA', { waitUntil: 'networkidle0' });

    // Select 'Till Now' radio button and click 'Show'
    await page.evaluate(() => {
      document.getElementById('radTillNow').click();
      document.getElementById('btnShow').click();
    });

    // Wait for the attendance data to load
    await page.waitForSelector('#tblReport');

    // Scrape the attendance data
    const attendanceData = await page.evaluate(() => {
      const reportData = [];
      const rows = document.querySelectorAll('#tblReport .cellBorder');

      rows.forEach((row, index) => {
        if (index % 5 === 0) reportData.push([]);
        reportData[reportData.length - 1].push(row.textContent.trim());
      });

      return reportData.map(entry => ({
        subject: entry[1],
        held: entry[2],
        attended: entry[3],
        percentage: entry[4]
      }));
    });

    // Close the browser
    await browser.close();

    // Return the scraped data
    res.json(attendanceData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching attendance');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

