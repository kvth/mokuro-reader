self.onmessage=async s=>{const{id:a,file:t}=s.data;try{const e=await createImageBitmap(t);self.postMessage({id:a,bitmap:e},{transfer:[e]})}catch(e){self.postMessage({id:a,error:e instanceof Error?e.message:"Failed to decode image"})}};
//# sourceMappingURL=thumbnail-decode-worker-CjSxYOb6.js.map
