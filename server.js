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
  let folder = sourseRoot + ctx.path;
  // output file
  if(!fs.existsSync(folder)){
    return ctx.body = `${folder} not found`;
  }
  if(fs.statSync(folder).isDirectory()){
    // output folder template
    return ctx.body = buildHTML(ctx.path, folder, fs.readdirSync(folder, {withFileTypes: true}));
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

app.listen(port, () => {
  require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    const root = `http://${add}:${port}/`;
    console.log(`static server (${chalk.yellow(sourseRoot)}) ' @ ${chalk.cyan(root)}`);
    console.log(chalk.gray(`options:`));
    console.log(chalk.gray(`\t -s <source>`));
    console.log(chalk.gray(`\t -p <port>`));
    console.log(chalk.gray(`\t -b do not open in browser`));
    !program.background && exec(`open ${root}`);
  });
});

function buildHTML(currentPath, absolutePath, items){
  let folderCount = 0;
  let fileCount = 0;
  return `
    <style>${styles}</style>
    <h3>${currentPath}</h3>
    <ul>
      <li><a class="link back" href="/">/</a></li>
      ${currentPath !== '/' ? '<li><a class="link back" href="../">..</a></li>' : '<li><a class="link back" href="./">.</a></li>'}
      ${items.map(dirent => dirent.isFile() ? 
        ++fileCount && `<li><a class="btn" href="./${dirent.name}?force=txt">txt</a><a class="link file" href="./${dirent.name}">${dirent.name}</a></li>`:
        ++folderCount && `<li><a class="link folder" href="./${dirent.name}/">${dirent.name}</a></li>`
        ).join('\n')}
    </ul>
    <span class="subtitle">${folderCount} folders & ${fileCount} files in ${absolutePath}</span>
  `;
}

function getStyle(){
  return `
    body{
      background: #f0f0f0;
      font-size: 13px;
    }
    a{
      text-decoration: none;
    }
    h3{
      margin-left: 30px;
      margin-bottom: 2px;
    }
    .subtitle{
      position: absolute;
      top: 32px;
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
      transition: all .22s ease;
      border-radius: 3px;
      border: 1px solid transparent;
      outline: none;
    }
    li:hover .link{
      background: #fff;
      border-color: #113285;
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
      transition: all .2s ease;
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
