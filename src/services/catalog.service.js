const http = require('http');
const https = require('https');
const productRepo = require('../data/repositories/productRepository');

function isPrivateIp(ip) {
    if (!ip) return true;
    const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
        const octets = ipv4Match.slice(1, 5).map(Number);
        if (octets.some(o => o < 0 || o > 255)) return true;
        const [a, b, c, d] = octets;
        if (a === 0) return true; // 0.0.0.0/8
        if (a === 10) return true; // 10.0.0.0/8
        if (a === 127) return true; // 127.0.0.0/8
        if (a === 169 && b === 254) return true; // 169.254.0.0/16
        if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
        if (a === 192 && b === 168) return true; // 192.168.0.0/16
        if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
        if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, 192.0.2.0/24
        if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true; // 198.18.0.0/15, 198.51.100.0/24
        if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24
        if (a >= 224) return true; // Multicast / Reserved
        return false;
    }

    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    if (normalized.startsWith('ff')) return true;

    if (normalized.startsWith('::ffff:')) {
        const rest = normalized.slice(7);
        if (rest.includes('.')) {
            return isPrivateIp(rest);
        }
        const hexParts = rest.split(':');
        if (hexParts.length === 2) {
            const p1 = parseInt(hexParts[0], 16);
            const p2 = parseInt(hexParts[1], 16);
            const o1 = (p1 >> 8) & 0xff;
            const o2 = p1 & 0xff;
            const o3 = (p2 >> 8) & 0xff;
            const o4 = p2 & 0xff;
            return isPrivateIp(`${o1}.${o2}.${o3}.${o4}`);
        }
    }

    return false;
}

function isBlockedHost(hostname) {
    if (!hostname) return true;
    const host = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.includes('internal-network')) {
        return true;
    }
    return isPrivateIp(host);
}

exports.search = (q) => productRepo.filterProducts(q);

exports.fetchRemoteAsset = (target, cb) => {
    let targetUrl;
    if (typeof target === 'string') {
        targetUrl = target;
    } else if (target && typeof target === 'object') {
        targetUrl = target.url || target.href || (target.hostname ? `http://${target.hostname}${target.path || ''}` : '');
    }

    if (!targetUrl || typeof targetUrl !== 'string') {
        return cb(new Error("Forbidden access rule triggered."));
    }

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch (err) {
        return cb(new Error("Forbidden access rule triggered."));
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return cb(new Error("Forbidden access rule triggered."));
    }

    if (isBlockedHost(parsed.hostname)) {
        return cb(new Error("Forbidden access rule triggered."));
    }

    const client = parsed.protocol === 'https:' ? https : http;
    client.get(parsed, (proxyRes) => {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => cb(null, body.substring(0, 50)));
    }).on('error', err => cb(err));
};
