#!/usr/bin/env node

const os = require('os');
const dns = require('dns');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const chalk = require('chalk');
const mime = require('mime');

const koa = require('koa');
const app = new koa();

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

const host = `http://${getLocalIP()}:${port}/`;

const sourseRoot = path.resolve(process.cwd(), source);

const styles = fs.readFileSync(`${__dirname}/style.css`);

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
    // download
    if (ctx.query.force === 'download') {
        ctx.set('content-type', 'application/octet-stream');
        return (ctx.body = fs.createReadStream(folder));
    }
    // static
    else {
        return await next();
    }
});
app.use(require('koa-static')(sourseRoot, { hidden: true }));

let server = app.listen(port, async () => {
    console.log(
        `server start@ ${chalk.cyan(host)}`,
        time ? chalk.green(`(${program.time} mins)`) : chalk.red(`(keep alive)`),
    );
    console.log(`local path: ${chalk.yellow(sourseRoot)}`);
    program.outputHelp((txt) => chalk.gray(txt));
    !program.background && exec(`open ${host}`);
});

time &&
    setTimeout(() => {
        server.close();
    }, time);

// func ------------------------------------------------------------------------------
async function getIP() {
    return new Promise((res, rej) => {
        dns.lookup(os.hostname(), function (err, addr, fam) {
            if (err) {
                console.error(err);
                return res('localhost');
            }
            res(addr);
        });
    });
}

function getLocalIP() {
    const networkInterfaces = os.networkInterfaces();
    const arr = networkInterfaces.en0.find((link) => link.family === 'IPv4');
    return arr.address;
}

// template -----------------------------------------------------------------------------------------------------------------------
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
          .map((part) => `<a href="${stack.push(part) && stack.join('/')}/">${part}</a>`)
          .join(' / ')}
    </h3>
    <ul>
      ${
          currentPath !== '/'
              ? '<li><a class="link back" href="../">..</a></li>'
              : '<li><a class="link back" href="./">.</a></li>'
      }
      ${items
          .map((dirent) =>
              dirent.isFile()
                  ? ++fileCount &&
                    `<li>
                <a class="btn view" title="view in text" href="./${dirent.name}?force=txt">view</a>
                <a class="btn download" title="download" href="./${dirent.name}?force=download">⬇</a>
                <div class="background"></div>
                <a class="link file" href="./${dirent.name}">${dirent.name}<span class="mime">${
                        mime.getType(absolutePath + dirent.name) || ''
                    }</span></a>
            </li>`
                  : ++folderCount && `<li><a class="link folder" href="./${dirent.name}/">${dirent.name}</a></li>`,
          )
          .join('\n')}
    </ul>
    <span class="subtitle">${folderCount} folder(s) & ${fileCount} file(s) in ${absolutePath}</span>
  `;
}
