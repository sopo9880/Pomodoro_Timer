/**
 * Bloomodoro B — high-resolution original botanical-fantasy player art.
 * Vector illustration at 320×432 rather than enlarged 48px rect sprites.
 * Renders locally as SVG->Image. No remote resources, event handlers or
 * user-data changes. Direction variants and owned cosmetics retain old IDs.
 */
export const AVATAR_HIRES_SIZE = Object.freeze({width:320,height:432});
const HAIR={
 "hair-natural":["#c2a18f","#edd3c3","#80675d"],
 "hair-chestnut":["#92664e","#d5a38b","#604b45"],
 "hair-silver":["#b8bcb8","#fff6ec","#819396"],
 "hair-bloom":["#c48394","#f7c6ce","#a06b78"],
};
const OUTFIT={
 "outfit-linen":["#496a55","#80a07c","#284636","#fff3df"],
 "outfit-forest":["#305a47","#64876e","#234236","#f0e0bf"],
 "outfit-garden":["#956d66","#d1a28b","#6d4948","#fff0dc"],
 "outfit-starlight":["#646c92","#a0a6c2","#3e476c","#f7ede8"],
};
const SHOES={"shoes-travel":["#79503d","#bc8966"],"shoes-boots":["#7f5c45","#dbab7a"],"shoes-sky":["#507b80","#acd1cf"]};
const choose=(obj,id,fallback)=>Object.hasOwn(obj,id)?obj[id]:obj[fallback];
function path(d,fill,stroke="#765e50",sw=3,extra=""){
 return '<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linejoin="round" '+extra+'/>';
}
function leaf(x,y,s=1,r=0){
 return '<g transform="translate('+x+' '+y+') rotate('+r+') scale('+s+')">'+
 path('M0 0Q-29-26-36-2Q-24 20 0 0Z','#63865a','#45644a',2)+
 path('M0 0Q31-28 36-7Q22 17 0 0Z','#98b684','#45644a',2)+
 path('M-27-3L0 0L25-9','none','#b6cca0',2)+'</g>';
}
function flower(x,y,s=1){
 return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
 '<g fill="#fff9ed" stroke="#d6a88f" stroke-width="2"><ellipse rx="8" ry="13" cy="-10"/>'+
 '<ellipse rx="8" ry="13" cy="10"/><ellipse rx="13" ry="8" cx="-10"/><ellipse rx="13" ry="8" cx="10"/></g>'+
 '<circle r="6" fill="#f0c477" stroke="#ad8252" stroke-width="2"/>'+
 '<circle cx="-2" cy="-2" r="2" fill="#fff2d6"/></g>';
}
function crown(hat){
 if(hat==="hat-straw")return path('M78 91Q96 29 155 25Q221 25 234 92Q166 115 78 91Z','#efd3a1','#977457',5)+
 path('M77 86Q166 106 235 83','none','#668564',12)+flower(211,73,.9);
 if(hat==="hat-flower")return leaf(89,94,.7,-22)+leaf(200,84,.68,24)+flower(109,69,1.1)+flower(149,50,.85)+flower(195,78,1.1);
 if(hat==="hat-star")return path('M79 99Q100 43 144 14Q195 8 232 95Q158 111 79 99Z','#878cae','#565675',6)+
 path('M154 14L163-4L170 15','none','#f6e7c5',5)+flower(177,53,.6);
 return leaf(95,90,.82,-21)+leaf(128,70,.55,12)+flower(107,78,1.12)+
 '<circle cx="95" cy="59" r="7" fill="#e5a28b"/>';
}
function eyes(dir,emotion){
 if(dir==="up")return '';
 const happy=emotion==="happy",shocked=emotion==="surprised";
 const xs=dir==="left"||dir==="right"?[188]:[132,188];
 let e='';
 for(const x of xs){
  if(happy){e+=path('M'+(x-11)+' 153Q'+x+' 141 '+(x+12)+' 153','none','#6a4842',4);continue;}
  e+='<path d="M'+(x-13)+' 141Q'+x+' 133 '+(x+13)+' 142" stroke="#65433d" stroke-width="4" fill="none"/>'+
   '<ellipse cx="'+x+'" cy="153" rx="10" ry="'+(shocked?15:13)+'" fill="#fff9f1" stroke="#67413f" stroke-width="3"/>'+
   '<ellipse cx="'+(x+2)+'" cy="155" rx="7" ry="11" fill="url(#iris)"/>'+
   '<ellipse cx="'+(x+3)+'" cy="156" rx="4" ry="8" fill="#462b29"/>'+
   '<circle cx="'+x+'" cy="149" r="4" fill="#fff"/><circle cx="'+(x+6)+'" cy="158" r="1.5" fill="#fff"/>';
 }
 return e+'<ellipse cx="119" cy="170" rx="13" ry="7" fill="#ecaaa0" opacity=".38"/>'+
 '<ellipse cx="203" cy="169" rx="13" ry="7" fill="#ecaaa0" opacity=".38"/>'+
 (shocked?'<ellipse cx="160" cy="183" rx="5" ry="7" fill="#ac7468"/>':
 path('M151 181Q160 187 169 180','none','#a9726e',2.5));
}
const defs='<defs>'+
 '<linearGradient id="hair" x1=".1" y1=".05" x2=".84" y2="1"><stop stop-color="var(--hair-highlight)"/><stop offset=".53" stop-color="var(--hair-main)"/><stop offset="1" stop-color="var(--hair-shadow)"/></linearGradient>'+
 '<linearGradient id="cloak" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--coat-light)"/><stop offset=".53" stop-color="var(--coat-main)"/><stop offset="1" stop-color="var(--coat-shadow)"/></linearGradient>'+
 '<linearGradient id="face" x1=".2" y1="0" x2=".7" y2="1"><stop stop-color="#fff4e8"/><stop offset=".63" stop-color="#ffe1ca"/><stop offset="1" stop-color="#e8ad97"/></linearGradient>'+
 '<radialGradient id="iris"><stop stop-color="#bd754c"/><stop offset=".55" stop-color="#9a5845"/><stop offset="1" stop-color="#53352e"/></radialGradient>'+
 '<linearGradient id="bag" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c49a76"/><stop offset=".55" stop-color="#845742"/><stop offset="1" stop-color="#563c35"/></linearGradient>'+
 '<linearGradient id="shoe"><stop stop-color="var(--shoe-light)"/><stop offset="1" stop-color="var(--shoe-dark)"/></linearGradient></defs>';
export function avatarIllustrationSvg(equipped={},direction="down",pose="idle",frame=0){
 const hair=choose(HAIR,equipped.hair,"hair-natural");
 const coat=choose(OUTFIT,equipped.outfit,"outfit-linen");
 const shoe=choose(SHOES,equipped.shoes,"shoes-travel");
 const dir=["up","down","left","right"].includes(direction)?direction:"down";
 const bounce=pose==="walk"?[0,-2,2][Math.abs(Math.floor(frame)%3)]:0;
 const swing=pose==="walk"?[-4,0,4][Math.abs(Math.floor(frame)%3)]:0;
 const emotion=pose==="surprised"?"surprised":pose==="happy"?"happy":"idle";
 const styling='<style>:root{--hair-main:'+hair[0]+';--hair-highlight:'+hair[1]+
 ';--hair-shadow:'+hair[2]+';--coat-main:'+coat[0]+';--coat-light:'+coat[1]+
 ';--coat-shadow:'+coat[2]+';--shoe-dark:'+shoe[0]+';--shoe-light:'+shoe[1]+'}</style>';
 const base='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="432" viewBox="0 0 320 432">'+defs+styling;
 const hairBack=path('M100 86Q57 97 51 151Q29 205 52 251Q15 290 36 316Q52 349 90 315Q94 357 122 352Q147 330 140 296L215 282Q228 352 252 346Q277 331 262 297Q298 311 296 271Q267 238 275 199Q287 121 234 86Q168 37 100 86Z','url(#hair)','#86685e',6)+
 path('M68 154Q57 229 73 269Q56 298 47 318M245 139Q267 204 244 263Q277 296 258 317M94 210Q110 267 94 321','none','#f7e4d8',5, 'opacity=".55"');
 const cloak=path('M115 206Q62 199 53 251L27 373Q59 396 101 369Q130 339 146 330Q178 360 203 352Q237 400 285 369L253 243Q235 207 209 204Z','url(#cloak)','#3e5144',6)+
 path('M67 242Q53 322 40 367M245 238Q273 326 272 370M101 359Q120 343 142 329','none','#efcf9f',4,'stroke-dasharray="2 7"');
 const boots=path('M123 335L126 383L150 380L151 333ZM176 337L173 382L200 379L199 332Z','#f3c4aa','#956f5c',4)+
 path('M118 376L155 377L160 417Q147 431 112 425ZM169 378L205 376L211 420Q197 429 164 425Z','url(#shoe)','#674a42',5)+
 path('M123 388L151 389M175 386L204 389M131 395L145 407L132 415M183 396L198 408L182 415','none','#efc78f',3)+
 path('M115 373L155 373M167 372L207 374','none','#fff5e4',7,'stroke-dasharray="6 4"');
 const dress=path('M117 227Q156 241 207 230L223 332Q227 343 251 365Q218 393 167 367Q129 393 81 365Q101 332 117 227Z','#fcf1df','#c4aa94',5)+
 path('M111 249Q93 319 81 357Q115 373 157 361L167 250Z','url(#cloak)','#405745',4)+
 path('M197 246Q223 302 246 362Q219 374 188 349L174 250Z','url(#cloak)','#405745',4)+
 path('M105 350Q134 372 162 359Q199 380 227 354','none','#fffaf0',12,'stroke-dasharray="6 4"')+
 path('M104 360Q144 384 164 368Q207 393 232 358','none','#ac8e7f',2)+
 path('M149 255Q162 263 181 255L179 354Q164 366 152 354Z','#fff7e9','#dbc5aa',2)+
 path('M153 281L176 292L155 303L175 313L156 327','none','#b4be93',3);
 const stitch=Array.from({length:13},(_,i)=>i%3?flower(83+i*13,346+Math.sin(i)*10,.18):leaf(83+i*13,348,.14,i*15)).join('');
 const sleeves=path('M119 211Q99 197 87 223L71 271Q77 291 99 285L121 245Z','#fff1df','#cbb29f',4)+
 path('M204 211Q230 197 240 227L257 274Q244 296 225 284L204 246Z','#fff1df','#cbb29f',4)+
 path('M86 260L106 268M225 271L247 260','none','#d4a988',3,'stroke-dasharray="3 4"')+
 path('M87 276Q79 294 93 302Q110 300 110 282Z','#ffe6cf','#c8998b',3)+
 path('M227 278Q229 302 244 299Q256 289 247 275Z','#ffe6cf','#c8998b',3);
 const shirt=path('M123 213L197 213L209 261Q160 274 117 261Z','#fff0df','#bba18a',3)+
 path('M151 211L155 252M173 214L176 252','none','#cfaa88',2.6)+
 path('M122 252L206 251','none','#835d43',11)+
 '<rect x="153" y="245" width="17" height="13" rx="3" fill="#edc389" stroke="#866544" stroke-width="3"/>';
 const bag=path('M208 210Q206 262 230 300','none','#795340',11)+
 path('M208 210Q206 263 230 300','none','#dab48a',2.5)+
 path('M223 283Q258 271 278 299L276 337Q245 354 219 335Z','url(#bag)','#654637',5)+
 path('M220 298Q243 289 276 305L273 318Q244 329 220 315Z','#ac805e','#67493d',3)+
 '<rect x="247" y="304" width="6" height="14" rx="2" fill="#ecc78c"/>'+flower(239,331,.37);
 const backHead=path('M101 94Q104 47 162 52Q222 46 230 109L248 212Q231 253 210 235Q172 216 157 216Q129 213 103 239Q72 214 85 178Z','url(#hair)','#82665a',5)+
 path('M110 92Q150 63 212 91M100 186Q125 206 154 203','none','#f2ded0',6,'opacity=".56"');
 const frontFace=path('M102 100Q147 55 211 93Q235 117 219 166Q199 199 159 206Q115 196 102 171Q86 135 102 100Z','url(#face)','#a27b6c',4)+
 eyes(dir,emotion);
 const sides=path('M99 105Q63 130 77 164Q86 191 65 223Q51 248 79 250Q107 237 114 195Z','url(#hair)','#8d7064',4)+
 path('M216 99Q258 122 243 177Q241 208 271 232Q283 261 251 267Q219 250 209 198Z','url(#hair)','#8d7064',4)+
 path('M83 159Q101 203 79 229M234 168Q222 219 258 244','none','#ffe9dc',5,'opacity=".72"');
 const bangs=path('M104 118Q101 64 151 67Q212 53 226 119L215 138Q197 125 192 111Q176 142 160 131Q146 146 130 132Q115 154 104 143Z','url(#hair)','#896a5d',5)+
 path('M113 113Q129 89 144 86M152 89Q173 80 184 97M197 91Q210 103 210 114','none','#ffe8d7',5.5,'opacity=".72"')+
 path('M137 107Q137 126 125 133M174 101Q168 120 162 130','none','#a58175',3);
 const face=dir==="up"?backHead:frontFace+sides+bangs;
 const mirror=dir==="left"?' translate(320 0) scale(-1 1)':'';
 return base+'<g transform="translate(0 '+bounce+')'+mirror+'">'+
 hairBack+boots+cloak+dress+stitch+shirt+sleeves+bag+face+crown(equipped.hat)+
 flower(163,211,.8)+leaf(152,211,.42)+
 '<circle cx="166" cy="256" r="8" fill="#e8c991" stroke="#8d6843" stroke-width="3"/>'+
 path('M166 250V256L169 260','none','#755d47',2)+'</g></svg>';
}
