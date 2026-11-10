import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:900}});
page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/ESP32-S3/}).first().click();
 await page.getByText('CAD MODEL INSPECTION',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Auto Arrange'}).click();
 await page.getByRole('button',{name:'Fit camera to circuit'}).click();
 await page.waitForTimeout(15000);
 await page.getByRole('button',{name:/Wire/}).first().click();
 await page.locator("button[data-component-id^='yd-'][data-pin-id='J3-20']").evaluate(el=>el.click());
 await page.locator("button[data-component-id='usb-a'][data-pin-id='A2']").evaluate(el=>el.click());
 await page.getByRole('button',{name:/Wire/}).first().click();
 await page.locator("button[data-component-id^='yd-'][data-pin-id='J3-19']").evaluate(el=>el.click());
 await page.locator("button[data-component-id='usb-a'][data-pin-id='A3']").evaluate(el=>el.click());
 await page.locator('.connection-row').filter({hasText:'GPIO19 / USB D-'}).last().waitFor();
 await page.getByRole('button',{name:'Fit camera to circuit'}).click();await page.waitForTimeout(400);
 await page.screenshot({path:'artifacts/sprint35-yd-cad-editor.png',timeout:90000});
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Captured final CAD editor view with measured GLB, both signal wires, model inspection and pin calibration controls.');
}finally{await browser.close()}
