const http = require('http');
const express = require('express');
const stackimpact = require('../..');


const agent = stackimpact.start({
  agentKey: process.env.AGENT_KEY,
  appName: 'MyNodeApp'
});


const app = express();


app.get('/hello', (req, res) => {
  let span = agent.profile("hello handler");

  // do some work
  for(let i = 0; i < 100000000; i++) {
    Math.random();
  }

  // wait for some other service
  http.get('http://localhost:3000/other', (response) => {
    res.send('Hello!')

    span.stop();
  });
})


app.get('/other', (req, res) => {
  setTimeout(() => {
    res.send('OK')
  }, 100);
});


app.listen(3000, () => console.log('Example app listening on port 3000!'))