#!/usr/bin/env node
const program = require('commander');
program
  .option('-s, --source <source>', 'root folder, default to .')
  .option('-p, --port <port>', 'port, default to random')
  .option('-b, --background', 'do not open browser');
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
  if(fs.statSync(folder).isFile()){
    return await next();
  }
  // output folder template
  let rs = fs.readdirSync(folder, {withFileTypes: true});
  ctx.body = `
    <style>${styles}</style>
    <h3>${ctx.path}</h3>
    <span>${rs.length} objects in folder ${folder}</span>
    <ul>
      ${ctx.path !== '/' ? '<li><a class="folder" href="../">..</a></li>' : ''}
      ${rs.map(dirent => dirent.isFile() ? 
        `<li><a class="file" href="./${dirent.name}">${dirent.name}</a></li>`:
        `<li><a class="folder" href="./${dirent.name}">${dirent.name}/</a></li>`
        ).join('\n')}
    </ul>`;
});
app.use(require('koa-static')(sourseRoot));

app.listen(port, () => {
  require('dns').lookup(require('os').hostname(), function (err, add, fam) {
    const root = `http://${add}:${port}/`;
    console.log(`static server (${chalk.yellow(sourseRoot)}) ' @ ${chalk.cyan(root)}`);
    console.log(chalk.gray(`options: -s <source> -p <port>`));
    !program.background && exec(`open ${root}`);
  });
});

function getStyle(){
  return `
  body{
    background: #f0f0f0;
    font-size: 13px;
  }
  h3{
    margin-left: 30px;
    margin-bottom: 2px;
  }
  span{
    display: inline-block;
    margin-left: 40px;
    color: #999;
    font-size: 0.6em;
  }
  li{
    list-style: none;
  }
  li a{
    display: block;
    padding: 0 12px;
    line-height: 20px;
    text-decoration: none;
    transition: all .22s ease;
    border-radius: 3px;
    border: 1px solid transparent;
  }
  li a:hover{
    background: #fff;
    border-color: #dedede;
  }
  li a:before{
    display: inline-block;
    margin-right: 10px;
  }
  .folder:before{
    content: '+';
  }
  .file{
    color: #333;
  }
  .file:before{
    content: '-';
  }
  `;
}
