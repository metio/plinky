import"./runtime-CCc3PWxx.js";var e=e=>`Note ${e?.level}`,t=((t,n={})=>e(t)),n=e=>`Können ${e?.rating}`,r=((e,t={})=>n(e)),i=e=>`Ich habe bei Plinky Note ${e?.level} erreicht!`,a=((e,t={})=>i(e));function o(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function s({title:e,detail:t}){let n=1080,r=1350,i=t?`<text x="${n/2}" y="800" fill="#a5b4fc" font-family="system-ui,sans-serif" font-size="56" text-anchor="middle">${o(t)}</text>`:``;return`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${r}" viewBox="0 0 ${n} ${r}">\
<rect width="${n}" height="${r}" fill="#0f172a"/>\
<defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>\
<rect x="0" y="0" width="${n}" height="14" fill="url(#brand)"/>\
<text x="${n/2}" y="150" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="48" font-weight="600" text-anchor="middle">Plinky</text>\
<text x="${n/2}" y="660" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="160" font-weight="800" text-anchor="middle">${o(e)}</text>\
${i}\
<text x="${n/2}" y="1270" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="40" text-anchor="middle">plinky.fun</text>\
</svg>`}export{t as i,a as n,r,s as t};