// Invitation adaptation: scores live only in this isolated game session.
(() => {
 const values = Object.create(null);
 const storage = {getItem:k=>Object.hasOwn(values,k)?values[k]:null,setItem:(k,v)=>{values[k]=String(v)},removeItem:k=>{delete values[k]},clear:()=>{for(const k of Object.keys(values))delete values[k]}};
 Object.defineProperty(window, 'localStorage', {value:storage});
 Object.defineProperty(document, 'cookie', {get:()=>'',set:()=>{},configurable:true});
})();
