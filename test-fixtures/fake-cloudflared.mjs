// Stand-in for cloudflared: prints a quick-tunnel URL to stderr, then idles.
console.error('INF |  https://acme-test.trycloudflare.com  |');
setInterval(() => {}, 1e3);
