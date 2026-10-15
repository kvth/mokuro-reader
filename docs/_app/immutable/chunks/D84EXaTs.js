import{x as t,l as r}from"./BsiDp_5e.js";import"./CIdDcuND.js";import"./D8PqdVHs.js";async function d(n,e){const a=t(n),s=e?`name='${a}' and '${e}' in parents and trashed=false`:`name='${a}' and trashed=false`,i=await r.listFiles(s,"files(id, name)");return i.length>0?i[0].id:null}export{d as f};
//# sourceMappingURL=D84EXaTs.js.map
