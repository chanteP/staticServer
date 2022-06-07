#!/usr/bin/env node

const os = require('os');
const dns = require('dns');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const chalk = require('chalk');
const mime = require('mime');
const qrcode = require('qrcode');

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

const getFilePath = (ctx) => sourseRoot + decodeURIComponent(ctx.path);

const styles = fs.readFileSync(`${__dirname}/style.css`);

app.use(async (ctx, next) => {
    let currentPath = decodeURIComponent(ctx.path);
    let folder = getFilePath(ctx);
    if (!fs.existsSync(folder)) {
        ctx.status = 404;
        return (ctx.body = `${folder} not found`);
    }
    if (fs.statSync(folder).isDirectory()) {
        // output folder template
        return (ctx.body = await buildHTML(currentPath, folder, fs.readdirSync(folder, { withFileTypes: true })));
    }
    return await next();
});

app.use(async (ctx, next) => {
    let folder = getFilePath(ctx);
    
    if (ctx.query.force !== 'view') {
        return await next();
    }
    // output preview content
    // video wrapper
    if (ctx.query.mime.startsWith('video/')) {
        ctx.set('content-type', 'text/html');
        ctx.body = `<video style="width:100%;" controls src="${ctx.origin + ctx.path}"></video>`;
        return;
    }
    ctx.set('content-type', 'text/plain;charset=utf-8');
    return (ctx.body = fs.createReadStream(folder));
});

app.use(async (ctx, next) => {
    let folder = getFilePath(ctx);
    
    // download
    if (ctx.query.force !== 'download') {
        return await next();
    }
    ctx.set('content-type', 'application/octet-stream');
    return (ctx.body = fs.createReadStream(folder));
});

app.use(require('koa-range'));
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
    try {
        const networkInterfaces = os.networkInterfaces();
        const ipHost = networkInterfaces.WLAN || networkInterfaces.en0;
        const arr = ipHost.find((link) => link.family === 'IPv4' || +link.family === 4);
        return arr.address;
    } catch {
        return 'localhost';
    }
}

async function buildQrCode(string) {
    return new Promise((res, rej) => {
        qrcode.toDataURL(
            string,
            {
                errorCorrectionLevel: 'H',
                type: 'image/jpeg',
                quality: 0.3,
                margin: 1,
                color: {
                    dark: '#333',
                    light: '#fff',
                },
            },
            function (err, url) {
                if (err) rej(err);
                res(url);
            },
        );
    });
}

// template 懒得拆文件了，将就吧-----------------------------------------------------------------------------------------------------------------------
async function buildHTML(currentPath, absolutePath, items) {
    let folderCount = 0;
    let fileCount = 0;
    let stack = [];
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="format-detection" content="telephone=no">
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>np-static</title>
    </head>
    <body>
    <style>${styles}</style>
    <h3>
      <a href="/">$root</a>
      ${currentPath
          .split('/')
          .map((part) => `<a href="${stack.push(part) && stack.join('/')}/">${part}</a>`)
          .join(' / ')}
    </h3>
    <ul id="$list">
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
                <a class="btn view" title="view in text" href="./${dirent.name}?force=view&mime=${mime.getType(
                        absolutePath + dirent.name,
                    )}" data-action="preview" data-type="${mime.getType(absolutePath + dirent.name) || ''}">view</a>
                <a class="btn download" title="download" href="./${dirent.name}?force=download">download</a>
                <div class="background"></div>
                <a class="link file" href="./${dirent.name}">${dirent.name}<span class="mime">${
                        mime.getType(absolutePath + dirent.name) || ''
                    }</span></a>
            </li>`
                  : ++folderCount && `<li><a class="link folder" href="./${dirent.name}/">${dirent.name}</a></li>`,
          )
          .join('\n')}
    </ul>
    <iframe id="$preview" style="display:none;" ></iframe>
    <div class="page-qrcode" title="${host}${currentPath}"><img src="${await buildQrCode(
        `${host}${currentPath}`,
    )}" /></div>
    <span class="subtitle">${folderCount} folder(s) & ${fileCount} file(s) in ${absolutePath}</span>
    <script>
        ${preview.toString()}
        $list.onmouseover = preview;
    </script>
    </body>
    </html>
    `;
}

function preview(e) {
    const target = e.target;
    if (target.dataset.action !== 'preview') {
        $preview.style.cssText = style =
            'border:1px solid #666;padding:6px;border-radius:4px;display:none;position:fixed;right:5px;top:5px;width:375px;height:667px;background:#fff;z-index:10;';
        $preview.removeAttribute('src');
        return;
    }
    const mime = target.dataset.type;
    const url = target.href;

    const supportType = {
        'image/': null,
        'text/html': (src) => src.split('?')[0],
        'text/': null,
        'video/': null,
        'application/pdf': null,
        'application/json': null,
        'application/javascript': null,
    };
    const handler = Object.keys(supportType).find((type) => mime.startsWith(type));
    if (!handler) {
        return;
    }

    console.log(handler);

    $preview.style.display = '';
    $preview.src = (handler && supportType[handler] && supportType[handler](url)) || url;
    $preview.onload = () => {
        const src = $preview.src;
        if (mime.startsWith('image/')) {
            const image = $preview.contentWindow.document.images[0];
            // image.onload = function () {
            if ($preview.src !== src) {
                return;
            }
            $preview.style.height = `${(375 / image.width) * image.height}px`;
            image.style.cssText = 'display:block;width:100vw;height:100vh;';
            // };
        }
    };
}
