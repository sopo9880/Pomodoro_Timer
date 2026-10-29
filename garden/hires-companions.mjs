/**
 * Original illustrated botanical companions (six) and wildlife (fourteen).
 * The B-look assets are translucent independent SVG images at 256/176 px.
 * Species IDs match the persistent garden and existing ecology simulations.
 */
export const ILLUSTRATED_COMPANIONS = Object.freeze(["sprout","mushroom","cat","sparrow","turtle","fox"]);
export const ILLUSTRATED_WILDLIFE = Object.freeze([
"butterfly","robin","honeybee","ladybug","dragonfly","frog","carp","firefly",
"owl","squirrel","fieldmouse","wren","lunamoth","glowbug",
]);
const FRIEND={
 sprout:["#7faf78","#c6d8a5","#476d56","#f4e9c9"],
 mushroom:["#db9d9a","#f6c7ba","#945d65","#fff3da"],
 cat:["#cf9b76","#f5d1ab","#966951","#fff2db"],
 sparrow:["#a88165","#e0c49d","#6e594b","#fff0da"],
 turtle:["#79a183","#c0d7ad","#517961","#f6ebcf"],
 fox:["#d99672","#f2c6a5","#a46e58","#fff3d9"],
};
const SPECIES=new Set(ILLUSTRATED_WILDLIFE);
const leaf=(x,y,s=1,r=0)=>
 '<g transform="translate('+x+' '+y+') rotate('+r+') scale('+s+')">'+
 '<path d="M0 0C-26-18-33 0-33 3C-17 17-8 8 0 0Z" fill="#597a58" stroke="#3e6249" stroke-width="3"/>'+
 '<path d="M0 0C22-31 34-12 34-10C29 9 16 12 0 0Z" fill="#91b17c" stroke="#496d52" stroke-width="3"/>'+
 '<path d="M-26 2L0 0L27-9" stroke="#d9e6b3" stroke-width="2"/></g>';
const flower=(x,y,s=1,p="#fff3df")=>
 '<g transform="translate('+x+' '+y+') scale('+s+')"><g fill="'+p+
 '" stroke="#c8a38d" stroke-width="2"><ellipse cy="-9" rx="7" ry="11"/>'+
 '<ellipse cy="9" rx="7" ry="11"/><ellipse cx="-9" rx="11" ry="7"/>'+
 '<ellipse cx="9" rx="11" ry="7"/></g>'+
 '<circle r="6" fill="#eac183" stroke="#ab8158" stroke-width="2"/></g>';
const p=(d,f,stroke="#6a594d",sw=3,extra="")=>'<path d="'+d+'" fill="'+f+
 '" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linejoin="round" '+extra+'/>';
function wrap(w,h,a,b,shape){
 const palette=a||FRIEND.sprout;
 const defs='<defs><linearGradient id="fur" x1=".15" y1=".06" x2=".92" y2="1">'+
 '<stop stop-color="'+palette[1]+'"/><stop offset=".53" stop-color="'+palette[0]+
 '"/><stop offset="1" stop-color="'+palette[2]+'"/></linearGradient>'+
 '<linearGradient id="highlight"><stop stop-color="#fff9eb"/><stop offset="1" stop-color="'+palette[3]+'"/></linearGradient>'+
 '<radialGradient id="eye"><stop stop-color="#b87558"/><stop offset=".7" stop-color="#6b4841"/><stop offset="1" stop-color="#493833"/></radialGradient></defs>';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+
 '" viewBox="0 0 '+w+' '+h+'" aria-hidden="true">'+defs+'<g transform="'+b+'">'+shape+'</g></svg>';
}
function face(x,y,look="idle",direction="down",scale=1){
 if(direction==="up")return flower(x-1,y+5,.36);
 const happy=look==="happy",shocked=look==="surprised"||look==="wiggle";
 const side=direction==="left"||direction==="right";
 let eyes="";
 for(const ex of (side?[x+22]:[x-21,x+21])){
   eyes+=happy?
   p('M'+(ex-9)+' '+(y+1)+'Q'+ex+' '+(y-10)+' '+(ex+9)+' '+(y+1),
      'none','#63463f',4):
   '<ellipse cx="'+ex+'" cy="'+y+'" rx="9" ry="'+(shocked?15:12)+
   '" fill="#fffbef" stroke="#69504a" stroke-width="3"/>'+
   '<ellipse cx="'+(ex+2)+'" cy="'+(y+2)+'" rx="6" ry="9" fill="url(#eye)"/>'+
   '<circle cx="'+ex+'" cy="'+(y-5)+'" r="3.6" fill="#fff"/>';
 }
 return '<g transform="translate('+x+' '+y+') scale('+scale+') translate('+-x+' '+-y+')">'+
 eyes+'<ellipse cx="'+(x-45)+'" cy="'+(y+13)+'" rx="11" ry="6" fill="#e99a95" opacity=".55"/>'+
 '<ellipse cx="'+(x+45)+'" cy="'+(y+13)+'" rx="11" ry="6" fill="#e99a95" opacity=".55"/>'+
 (shocked?'<ellipse cx="'+x+'" cy="'+(y+27)+'" rx="5" ry="8" fill="#9f6861"/>':
 p('M'+(x-9)+' '+(y+24)+'Q'+x+' '+(y+34)+' '+(x+9)+' '+(y+24),
 'none','#9d6f61',3))+'</g>';
}
function details(id,activity,frame,emotion){
 const wiggle=activity==="picked",jump=activity==="hop",offset=(frame%3-1)*4;
 if(id==="sprout")return leaf(115,70,1.2,-14)+leaf(164,72,1.08,19)+
  p('M124 77Q112 50 133 39','none','#517d52',9)+
  flower(151,67,.55)+flower(96,120,.46,'#f4ced0')+
  p('M88 191Q111 204 148 207Q174 194 193 187','none','#ddc991',7);
 if(id==="mushroom")return p('M40 125Q48 48 132 45Q208 43 219 123Q204 149 47 141Z',
  '#c9898c','#7d575a',7)+
  p('M59 125Q113 148 203 124','none','#fff2df',7)+
  '<ellipse cx="93" cy="98" rx="18" ry="12" fill="#ffe8d7"/>'+
  '<ellipse cx="154" cy="78" rx="19" ry="13" fill="#fff3e4"/>'+
  '<ellipse cx="187" cy="108" rx="10" ry="7" fill="#ffdfd5"/>'+leaf(155,58,.45)+
  flower(94,69,.64);
 if(id==="cat")return p('M58 113L60 43Q62 28 82 49L110 86L160 84L194 41Q214 27 213 56L207 117',
 'url(#fur)','#875d4c',7)+
 p('M67 80L71 51L92 84M180 84L203 52L201 91','#f3b9ac','#a77a64',2)+
 p('M198 189Q259 179 220 129Q240 146 228 172','none','#ae765b',18)+
 p('M111 157L98 152M173 155L188 151','none','#7d5b50',2.5)+flower(89,81,.49);
 if(id==="sparrow")return p('M35 151Q7 111 48 97Q69 130 72 159','url(#fur)','#795f50',7)+
 p('M215 152Q251 109 208 98Q180 121 186 163','url(#fur)','#795f50',7)+
 p('M94 109Q109 69 150 78Q188 77 190 106','#a37e60','#735848',5)+
 p('M174 146L224 155L178 169','#efb977','#91694b',4)+
 p('M89 180Q127 192 170 177','none','#fff1ca',9)+flower(86,93,.56);
 if(id==="turtle")return p('M47 174Q31 111 86 82Q144 48 202 86Q238 117 221 179Q149 211 47 174Z',
 '#8d876a','#526b5a',8)+
 p('M80 105Q143 73 191 105L205 162Q150 194 72 157Z','#9eb18b','#5a7b63',5)+
 p('M136 86L121 124L141 155L173 129L156 92ZM77 127L120 123L140 154L99 174L71 151ZM176 123L206 127L198 160L143 156Z',
 '#c9bea0','#667e60',4)+leaf(87,77,.41)+flower(180,82,.5);
 return p('M78 110L73 34Q87 27 118 87L157 85L193 34Q211 38 201 116',
 '#dd996d','#995c47',7)+
 p('M86 87L83 51L111 88M166 89L193 52L192 101','#f6c1a7','#c58b72',3)+
 p('M195 187Q253 205 229 149Q242 179 208 176','none','#b76a4c',23)+
 p('M206 171Q231 171 226 158','none','#fff0cf',10)+
 p('M105 170Q139 185 172 164','none','#fff0d9',9)+flower(185,81,.43);
}
export function companionIllustrationSvg(id="sprout",dir="down",activity="idle",frame=0,reaction=null){
 const kind=Object.hasOwn(FRIEND,id)?id:"sprout";
 const palette=FRIEND[kind];const held=activity==="picked";
 const motion=activity==="walk"||held?[-4,0,3][Math.abs(Math.floor(frame)%3)]:0;
 const rotation=held?((frame%2)?-7:8):0;
 const emotion=reaction==="happy"?"happy":held?(frame%2?"wiggle":"surprised"):
   reaction==="surprised"?"surprised":activity==="react"?"happy":"idle";
 const flip=dir==="left"?'translate(256 0) scale(-1 1) ':'';
 const transform=flip+'translate(0 '+motion+') rotate('+rotation+' 128 143)';
 const body=p('M90 145Q56 158 62 203Q94 229 128 223Q170 233 199 201Q205 167 164 145Z','url(#fur)',palette[2],6)+
 p('M97 190Q128 205 166 191','none',palette[3],10)+
 p('M85 212Q75 236 92 243M166 216Q181 240 166 245','none',palette[2],14)+
 p('M67 167Q45 182 64 202M189 169Q214 184 193 204','none',palette[1],15)+
 p('M72 130Q69 80 121 72Q175 65 205 114Q219 158 179 177Q128 196 90 169Q69 152 72 130Z',
  'url(#fur)',palette[2],7)+
 p('M91 122Q125 85 169 113','none',palette[1],9,'opacity=".45"');
 const arm=held?
 p('M73 167Q48 142 47 151M186 168Q210 141 212 152','none',palette[2],10):'';
 return wrap(256,256,palette,transform,
 '<ellipse cx="127" cy="242" rx="66" ry="8" fill="#423830" opacity=".15"/>'+
 details(kind,activity,frame,emotion)+body+arm+
 face(134,126,emotion,dir)+
 leaf(104,182,.45,-12)+flower(160,188,.55)+
 '<circle cx="154" cy="193" r="5" fill="#f3c985"/>');
}
const WILDCOLOR={
 butterfly:["#eeb89d","#fbe4c9","#9a796a","#fff4e3"],
 lunamoth:["#b2cbb7","#eff5dd","#839b92","#ffedda"],
 honeybee:["#e3b76c","#ffead0","#866f59","#f9e4b7"],
 ladybug:["#d68679","#ffd9c2","#95655f","#fff5df"],
 dragonfly:["#9ebabe","#e7f5dd","#7799a1","#e7fffd"],
 firefly:["#d1d6a1","#fff5c5","#839978","#fff2c1"],
 glowbug:["#c7c0e0","#f0f7cc","#8d8baa","#fff6bb"],
 carp:["#db9f7c","#f9d4a2","#a16d5b","#f6f0d9"],
 frog:["#8bbd8a","#d5e5b7","#5b8f70","#f5f4d5"],
 owl:["#ab8b70","#f1d3ae","#705e52","#fff3e5"],
 squirrel:["#bd906e","#efc6a3","#8c6c5b","#fff2d8"],
 fieldmouse:["#b3a39b","#e6cfbe","#7d7473","#fff4df"],
 robin:["#b98770","#f1dbb7","#806450","#fff0da"],
 wren:["#b0a17c","#e9d6ae","#746b57","#fff2d6"],
};
function bugParts(id){
 if(id==="ladybug")return p('M83 65Q86 28 125 33Q165 37 170 76L158 126L95 126Z','#c97773','#865951',6)+
  p('M126 34L126 119','none','#664d4f',5)+
  [[99,69],[145,68],[109,100],[148,100]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="7" fill="#6d504f"/>').join('');
 if(id==="dragonfly")return p('M120 80Q65-1 19 52Q23 88 114 93M135 83Q192-3 238 52Q226 92 139 95',
 'url(#fur)','#8ca6ae',3)+
 p('M122 108Q44 86 39 143Q92 161 125 123M134 110Q204 85 215 139Q186 160 136 128',
 '#c1d8d2','#8daab1',3)+
 p('M127 75L129 198','none','#638783',12);
 if(id==="butterfly"||id==="lunamoth")return p('M116 95Q46 3 21 69Q4 132 113 133Q48 190 72 219Q111 230 126 146Z',
 'url(#fur)','#957f78',6)+
 p('M141 96Q208 2 235 72Q250 136 141 134Q211 191 182 219Q140 230 130 146Z',
 'url(#fur)','#957f78',6)+
 '<circle cx="65" cy="92" r="16" fill="#fff1d8" opacity=".68"/>'+
 '<circle cx="194" cy="92" r="16" fill="#fff1d8" opacity=".68"/>'+
 '<circle cx="78" cy="164" r="10" fill="#fff7d6"/><circle cx="179" cy="164" r="10" fill="#fff7d6"/>';
 if(id==="honeybee")return p('M127 61Q47 5 29 67Q64 92 121 88M134 59Q205 6 224 64Q207 94 134 88',
 '#e8f5eb','#9dbfb0',4)+
 p('M72 128L186 128M76 160L186 160','none','#876d54',15)+
 p('M126 202Q107 223 130 224Q151 224 126 202','#a9765b','#765849',3);
 return p('M125 70Q49 26 41 111Q66 154 122 122M130 74Q219 20 228 115Q193 152 130 124',
 'url(#fur)','#7f977e',5)+
 '<circle cx="128" cy="120" r="32" fill="#fff2b7" opacity=".68"/>';
}
function birdParts(id){
 if(id==="owl")return p('M85 101L77 34L119 75L150 75L187 30L182 110',
 'url(#fur)','#766254',7)+
 p('M91 104Q133 75 176 104','none','#f5e3c8',9);
 return p('M69 130Q28 92 39 66Q85 85 94 120M179 130Q223 83 210 67Q172 90 169 127',
 'url(#fur)','#795f4d',6)+
 p('M131 126L188 138L134 153','#e9bb83','#906e57',3);
}
export function wildlifeIllustrationSvg(species="butterfly",frame=0){
 const id=SPECIES.has(species)?species:"butterfly";
 const palette=WILDCOLOR[id],n=Math.abs(Math.floor(frame)%3);
 const bob=n===0?-2:n===1?0:2;
 const isBug=["butterfly","honeybee","ladybug","dragonfly","firefly","lunamoth","glowbug"].includes(id);
 const bird=["robin","wren","owl"].includes(id);
 const form=isBug?bugParts(id):bird?birdParts(id):
 id==="carp"?p('M44 126Q104 53 164 104L221 61L212 126L222 190L163 149Q100 192 44 126Z','url(#fur)',palette[2],6):
 id==="frog"?p('M83 111Q62 67 91 56Q118 40 122 91Q145 37 176 56Q199 74 171 112','url(#fur)',palette[2],6):
 p('M83 91L74 53L100 72M165 72L195 50L182 100','url(#fur)',palette[2],5);
 const body=p('M80 116Q82 66 125 71Q176 68 184 116L196 171Q180 203 131 202Q78 200 65 165Z',
  'url(#fur)',palette[2],6)+
 p('M97 171Q134 190 162 166','none',palette[3],11)+
 (bird?'<ellipse cx="123" cy="131" rx="31" ry="34" fill="'+palette[3]+'" opacity=".66"/>':'');
 return wrap(256,256,palette,'translate(0 '+bob+')',form+body+
 face(128,125,"idle","down",.74)+
 (["firefly","glowbug"].includes(id)?
 '<circle cx="129" cy="185" r="24" fill="#fff2a5" opacity=".5"/>'+
 '<circle cx="130" cy="189" r="13" fill="#ffffdf"/>':'')+
 (bird?leaf(68,182,.38):flower(189,174,.33)));
}
