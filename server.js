#!/usr/bin/env node
const program = require('commander');
program
  .option('-s, --source <source>', 'root folder, default to .')
  .option('-p, --port <port>', 'port, default to random')
  .option('-b, --background', 'do not open in browser');
program.parse(process.argv);

const source = program.source || './';
const port = program.port || Math.round(8000 + Math.random() * 1000);
 
const koa = require('koa');
const app = new koa;

const chalk = require('chalk');

const path = require('path');
const fs = require('fs');
const {exec} = require('child_process');

const sourseRoot = path.resolve(process.cwd(), source);

const styles = getStyle();

app.use(async (ctx, next) => {
  let currentPath = decodeURIComponent(ctx.path);
  let folder = sourseRoot + currentPath;
  if(!fs.existsSync(folder)){
    return ctx.body = `${folder} not found`;
  }
  if(fs.statSync(folder).isDirectory()){
    // output folder template
    return ctx.body = buildHTML(currentPath, folder, fs.readdirSync(folder, {withFileTypes: true}));
  }
  // output text
  if(ctx.query.force === 'txt'){
    ctx.set('content-type', 'text/plain');
    return ctx.body = fs.createReadStream(folder);
  }
  // static
  else{
    return await next();
  }
});
app.use(require('koa-static')(sourseRoot, {hidden: true}));

app.listen(port, async () => {
    const root = `http://${await getIP()}:${port}/`;
    console.log(`static server (${chalk.yellow(sourseRoot)}) ' @ ${chalk.cyan(root)}`);
    console.log(chalk.gray(`options:`));
    console.log(chalk.gray(`\t -s <source>`));
    console.log(chalk.gray(`\t -p <port>`));
    console.log(chalk.gray(`\t -b do not open in browser`));
    !program.background && exec(`open ${root}`);
});

async function getIP(){
  return new Promise((res, rej) => {
    require('dns').lookup(require('os').hostname(), function (err, add, fam) {
      err ? rej(err) : res(add);
    })
  });
}

// build html template
function buildHTML(currentPath, absolutePath, items){
  let folderCount = 0;
  let fileCount = 0;
  let stack = [];
  return `
    <style>${styles}</style>
    <h3>
      <a href="/">$root</a>
      ${currentPath.split('/').map(part => `<a href="${stack.push(part) && stack.join('/')}/">${part}</a>`).join(' / ')}
    </h3>
    <ul>
      ${currentPath !== '/' ? '<li><a class="link back" href="../">..</a></li>' : '<li><a class="link back" href="./">.</a></li>'}
      ${items.map(dirent => dirent.isFile() ? 
        ++fileCount && `<li><a class="btn" href="./${dirent.name}?force=txt">view</a><a class="link file" href="./${dirent.name}">${dirent.name}</a></li>`:
        ++folderCount && `<li><a class="link folder" href="./${dirent.name}/">${dirent.name}</a></li>`
        ).join('\n')}
    </ul>
    <span class="subtitle">${folderCount} folder & ${fileCount} file in ${absolutePath}</span>
  `;
}

function getStyle(){
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
