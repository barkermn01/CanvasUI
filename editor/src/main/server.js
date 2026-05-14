const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

let server = null;
let wss = null;
let clients = new Set();

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

function startServer(options = {}) {
    return new Promise((resolve, reject) => {
        const { port = 31589, host = '127.0.0.1', webroot = './www' } = options;

        // Resolve webroot - check for packaged app resources first, then project root
        const projectRoot = path.resolve(__dirname, '..', '..', '..');
        let webrootPath;

        // If running as packaged app, check resources directory
        const resourcesWww = path.join(process.resourcesPath || '', 'www');
        if (process.resourcesPath && fs.existsSync(resourcesWww)) {
            webrootPath = resourcesWww;
        } else {
            webrootPath = path.resolve(projectRoot, webroot);
        }

        if (server) {
            reject(new Error('Server is already running'));
            return;
        }

        server = http.createServer((req, res) => {
            const url = new URL('http://localhost' + req.url);
            let filePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
            filePath = path.join(webrootPath, filePath);

            // Security: prevent directory traversal
            if (!filePath.startsWith(webrootPath)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            try {
                const content = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
                res.end(content);
            } catch (e) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            }
        });

        // WebSocket server for live reload
        wss = new WebSocketServer({ server });
        wss.on('connection', (ws) => {
            clients.add(ws);
            ws.on('close', () => clients.delete(ws));
            ws.on('error', () => clients.delete(ws));
        });

        server.on('error', (err) => {
            server = null;
            wss = null;
            reject(err);
        });

        server.listen(port, host, () => {
            console.log(`CanvasUI server running on http://${host}:${port}`);
            resolve({ port, host, webroot: webrootPath });
        });
    });
}

function stopServer() {
    return new Promise((resolve) => {
        if (!server) {
            resolve();
            return;
        }

        // Close all WebSocket connections
        clients.forEach(ws => {
            try { ws.close(); } catch (e) {}
        });
        clients.clear();

        if (wss) {
            wss.close();
            wss = null;
        }

        server.close(() => {
            server = null;
            console.log('CanvasUI server stopped');
            resolve();
        });
    });
}

function isRunning() {
    return server !== null;
}

function broadcastReload() {
    const message = JSON.stringify({ type: 'config-reload' });
    clients.forEach(ws => {
        try {
            if (ws.readyState === 1) {
                ws.send(message);
            }
        } catch (e) {}
    });
    return clients.size;
}

function getClientCount() {
    return clients.size;
}

module.exports = {
    startServer,
    stopServer,
    isRunning,
    broadcastReload,
    getClientCount
};
