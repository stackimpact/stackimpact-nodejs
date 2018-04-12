const fs = require('fs');
const os = require('os');
const child_process = require('child_process')
const abiMap = require('./abi-map.json');


let abi = abiMap[process.version];
if (abi) {
  let addonPath = `./addons/${os.platform()}-${process.arch}/stackimpact-addon-v${abi}.node`;
  if (fs.existsSync(addonPath)) {
    console.log('Pre-built version of StackImpact addon found, not building.');
    return;
  }
  else {
    console.log('Pre-built version of StackImpact is not available, fallback to node-gyp.');
  }
}
else {
  console.log('Pre-built version of StackImpact is not available (ABI not found), fallback to node-gyp.');
}

let gyp = child_process.spawn('node-gyp', ['rebuild'], {cwd: process.cwd(), env: process.env, stdio: 'inherit'});

gyp.on('error', (err) => {
  console.error('node-gyp not found.');
  process.exit(1);
});

gyp.on('close', (code) => {
  process.exit(code);
});