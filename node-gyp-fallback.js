const fs = require('fs');
const os = require('os');
const child_process = require('child_process')


let addonPath = `./prebuilt/${os.platform()}/${process.arch}/${process.version}/stackimpact-addon.node`;
try {
  if (fs.statSync(addonPath).isFile()) {
    console.log('Pre-built version of StackImpact addon found, not building.');
    return;
  }
}
catch(err) {
  console.log('Pre-built version of StackImpact addon not found, trying to build.');
}

let gyp = child_process.spawn('node-gyp', ['rebuild'], {cwd: process.cwd(), env: process.env, stdio: 'inherit'});

gyp.on('error', (err) => {
  console.log('node-gyp not found.');
  process.exit(1);
});

gyp.on('close', (code) => {
  process.exit(code);
});