const puppeteer = require('puppeteer');
const fs = require('fs').promises;
var express = require("express");
var app = express();
var axios = require('axios');
app.use(express.json());

global.run = true;
global.msgURL = 'https://www.tiktok.com/@pi2ttk/video/7043468337501703451';
global.msgToken = '';
global.sendNumber = '';

async function start(){
	global.browser = await puppeteer.launch({ headless: true });
	global.cookiesString = await fs.readFile('./cookies.json');
	global.oldCookies = JSON.parse(cookiesString);
	global.page = await browser.newPage();
}

// Call start
(async() => {
  console.log('preparing');

  await start();
  
  console.log('ready!!');
  // sendMessage('system ready');
})();

app.post('/secure', (req, res) => {
	const data = req.body;
	console.log(data)
	if (data["token"]) {
		secureSession(data, res);
	} else {
		return res.send(401, '{"status": "failed", "reason": "no token"}');
	}
});

app.get('/secure', (req, res) => {
	getImage(res);
});

app.post('/login', (req, res) => {
	const data = req.body;
	setup(data, req, res);
});

app.post('/settings', (req, res) => {
	const data = req.body;
	global.msgURL = data['msg_url'];
	global.msgToken = data['msg_token'];
	global.sendNumber = data['send_number'];
	return res.json('{"status": "success"}');
});

app.get('/settings', (req, res) => {
	const data = {};
	data['msg_url'] = global.msgURL;
	data['msg_token'] = global.msgToken;
	data['send_number'] = global.sendNumber;
	console.log(data);
	return res.json(data);
});

app.get('/logout', (req, res) => {
	logout(res);
});

app.get('/stop', (req, res) => {
	run = false;
	return res.json('{"status": "success"}');
});

app.get('/resume', (req, res) => {
	run = true;
	return res.json('{"status": "success"}');
});

app.get('/status', (req, res) => {
	return res.json('{"status": "running", "page":"'+page.url()+'"}');
});


let count = 0;
let tryLogin = 0;

async function secureSession(data, res){
	await page.type('input[type=text]', data["token"]);
	await page.click('input[type="submit"]');
	
	console.log('wait for myTabContent ');
	await page.waitForSelector('#myTabContent', {timeout: 0});
	console.log('myTabContent found ');
	const cookies = await page.cookies()
	await fs.writeFile('./cookies.json', JSON.stringify(cookies, null, 2));
	// console.log('cookies:', cookies);
	setViews(page, false);
	return res.json('{"status": "success"}');
}

async function setup(data, req, res){
	global.run = true;
	console.log('setup begin');
	await page.setCookie(...oldCookies);
	await page.goto('https://fireliker.com/welcome.php', {
		waitUntil: 'networkidle2',
	});
	const alert = await page.$('.alert-danger');
	if (alert != null){
		await login(data, req, res);
	} else {
		setViews(page, false);
		return res.json('{"status": "success"}');
	}
}


async function login(data, req, res){
	tryLogin++;
	console.log('try login ', tryLogin);
	await page.type('input[type=text]', data['account']);
	await page.click('button[type="submit"]');
	
	const alert = await page.$('.alert-danger');
	if (alert != null){
		if (tryLogin > 3) {
			tryLogin = 0;
			return res.json('{"status": "failed to login, try again"}');
		} else {
			await login(data, req, res);
		}
		
	} else {
		const ready = await page.waitForSelector('#ready');
		console.log('New Page URL:', page.url());
		await page.goto('https://fireliker.com/welcome.php', {
			waitUntil: 'networkidle2',
		});
		if (page.url() == 'https://fireliker.com/secure.php') {
			await sleep(1500);
			await page.screenshot({ path: 'secure.png' });
			
			sendImage(res);
		}
	}
	
}

async function getImage(res){
	await page.goto('https://fireliker.com/secure.php', {
		waitUntil: 'networkidle2',
	});
	await sleep(1500);
	await page.screenshot({ path: 'secure.png' });
	sendImage(res);
}

function sendImage(res){
	res.sendFile(__dirname + '/secure.png');
}

async function setViews(page, reload) {
  if (reload){
	  await page.reload();
  } else {
	  await page.goto('https://fireliker.com/autoviews.php', {
		waitUntil: 'networkidle2',
	  });
  }
  if (page.url() == 'https://fireliker.com/secure.php'){
	console.log('securing...');
	sendMessage('need securing');
	await sleep(1500);
	await page.screenshot({ path: 'secure.png' });
	return;
  }
  
  await page.waitForSelector('#home');
  const btn = await page.$('#home button')
  // console.log('btn:', btn);
  if (btn == null) {
	  console.log('btn === undefined');
	  await setViews(page, true);
  } else {
	  count++;
	  await page.click('#home button');
	  console.log('count:', count);
	  console.log('waiting...');
	  await sleep(60000);
	  console.log('current page: ',  page.url());
	  if (page.url() == 'https://fireliker.com/secure.php'){
		console.log('securing...');
		sendMessage('need securing');
		await sleep(1500);
		await page.screenshot({ path: 'secure.png' });
		return;
	  }
	  for (let i = 0; i < 300; i++) {
		  await sleep(1000);
		  if (!global.run) {
			  break;
		  }
	  }
	  if (global.run) {
		  await setViews(page, false);
	  }
  }
}

async function logout(res){
	await page.goto('https://fireliker.com/logout.php', {
		waitUntil: 'networkidle2',
	});	
	return res.json('{"status": "success"}');
}

function sendMessage(msg){
	axios.post(global.msgURL, {
		token: global.msgToken,
		number: global.sendNumber,
		message: msg
	})
	.then(function (response) {
		// console.log(response);
	})
	.catch(function (error) {
		console.log(error);
	});
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

app.listen(3001, () => {
 console.log("Server running on port 3001");
});
