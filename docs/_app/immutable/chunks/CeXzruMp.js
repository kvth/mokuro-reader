/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */function i(t){const r=/[○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;return Array.from(t).filter(n=>r.test(n)).length}function h(t,r){let n=0,a=0;if(t&&t.length>0){const c=r||t.length;for(let e=0;e<c;e++)t[e].blocks.forEach(o=>{a+=o.lines.length,o.lines.forEach(l=>{n+=i(l)})})}return{charCount:n,lineCount:a}}export{i as c,h as g};
//# sourceMappingURL=CeXzruMp.js.map
