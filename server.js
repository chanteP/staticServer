#!/usr/bin/env node
const program = require('commander');
program
  .option('-s, --source <source>', 'root, default to ./')
  .option('-p, --port <port>', 'port, default to use random port', Math.round(8000 + Math.random() * 1000))
  .option('-b, --background', 'do not open in browser')
  .option('-t, --time <expire>', 'expire time, default to 15min. set 0 to keep alive', 15)
  .option('-a, --alive', 'keep alive');
program.parse(process.argv);

const source = program.source || program.args[0] || './';
const port = program.port;
const time = program.alive ? 0 : program.time * 60 * 1000;

const koa = require('koa');
const app = new koa();

const chalk = require('chalk');

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const sourseRoot = path.resolve(process.cwd(), source);

const styles = getStyle();

app.use(async (ctx, next) => {
  let currentPath = decodeURIComponent(ctx.path);
  let folder = sourseRoot + currentPath;
  if (!fs.existsSync(folder)) {
    ctx.status = 404;
    return (ctx.body = `${folder} not found`);
  }
  if (fs.statSync(folder).isDirectory()) {
    // output folder template
    return (ctx.body = buildHTML(currentPath, folder, fs.readdirSync(folder, { withFileTypes: true })));
  }
  // output text
  if (ctx.query.force === 'txt') {
    ctx.set('content-type', 'text/plain');
    return (ctx.body = fs.createReadStream(folder));
  }
  // static
  else {
    return await next();
  }
});
app.use(require('koa-static')(sourseRoot, { hidden: true }));

let server = app.listen(port, async () => {
  const root = `http://${await getIP()}:${port}/`;
  console.log(
    `server start@ ${chalk.cyan(root)}`,
    time ? chalk.green(`(${program.time} mins)`) : chalk.red(`(keep alive)`)
  );
  console.log(`local path: ${chalk.yellow(sourseRoot)}`);
  program.outputHelp(txt => chalk.gray(txt));
  !program.background && exec(`open ${root}`);
});

time &&
  setTimeout(() => {
    server.close();
  }, time);

// func ------------------------------------------------------------------------------
async function getIP() {
  return new Promise((res, rej) => {
    require('dns').lookup(require('os').hostname(), function(err, addr, fam) {
      if (err) {
        console.error(err);
        return res('localhost');
      }
      res(addr);
    });
  });
}

// build html template
function buildHTML(currentPath, absolutePath, items) {
  let folderCount = 0;
  let fileCount = 0;
  let stack = [];
  return `
    <style>${styles}</style>
    <h3>
      <a href="/">$root</a>
      ${currentPath
        .split('/')
        .map(part => `<a href="${stack.push(part) && stack.join('/')}/">${part}</a>`)
        .join(' / ')}
    </h3>
    <ul>
      ${
        currentPath !== '/'
          ? '<li><a class="link back" href="../">..</a></li>'
          : '<li><a class="link back" href="./">.</a></li>'
      }
      ${items
        .map(dirent =>
          dirent.isFile()
            ? ++fileCount &&
              `<li><a class="btn" href="./${dirent.name}?force=txt">view</a><a class="link file" href="./${dirent.name}">${dirent.name}</a></li>`
            : ++folderCount && `<li><a class="link folder" href="./${dirent.name}/">${dirent.name}</a></li>`
        )
        .join('\n')}
    </ul>
    <span class="subtitle">${folderCount} folder & ${fileCount} file in ${absolutePath}</span>
  `;
}

function getStyle() {
  return `
    body{
      margin: 0;
      background: #f0f0f0;
      font-size: 13px;
    }
    a{
      text-decoration: none;
    }
    h3{
      margin: 0;
      padding: 8px 30px;
      background: #0B346E;
      color: #fff;
    }
    h3 a{
      color: #fff;
    }
    .subtitle{
      position: absolute;
      top: 44px;
      display: inline-block;
      margin-left: 40px;
      color: #999;
      font-size: 0.6em;
    }
    ul{
      margin-top: 25px;
    }
    li{
      position: relative;
      list-style: none;
    }
    li .link{
      display: block;
      padding: 0 12px;
      line-height: 20px;
      transition: all .1s ease;
      border-radius: 0;
      border: 1px solid transparent;
      outline: none;
    }
    li:hover .link{
      background: #fff;
      border-color: #113285;
      border-radius: 3px;
      font-weight: 700;
    }
    li .link:before{
      display: inline-block;
      width: 20px;
      margin-right: 10px;
    }
    li .btn{
      position: absolute;
      left: 1px;
      top: 1px;
      width: 30px;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      line-height: 20px;
      background: #113285;
      transition: all .05s ease;
      visibility: hidden;
      opacity: 0;
    }
    li .btn:hover{
      background: #1B813E;
    }
    li:hover .btn:hover + .link{
      border-color: #1B813E;
    }
    li:hover .btn{
      visibility: visible;
      opacity: 1;
    }
    .back:before{
      content: ' ';
    }
    .back,
    .folder{
      font-weight: 700;
    }
    .folder{
      color: #0B346E;
      background: #0b346e14;
    }
    .folder:before{
      content: '+';
    }
    .folder:after{
      content: '/';
    }
    .file{
      color: #333;
    }
    .file:before{
      content: '-';
    }
  `;
}
