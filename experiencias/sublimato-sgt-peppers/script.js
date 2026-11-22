(()=>{
"use strict";
const scenes=[...document.querySelectorAll(".scene")];
if(!scenes.length)return;
let index=Math.max(0,scenes.findIndex(s=>s.classList.contains("active")));
let timer=0,locked=false,touch=null;
const STEP_MS=3900,FADE_MS=580;
function clear(){if(timer){clearTimeout(timer);timer=0;}}
function videos(){scenes.forEach((s,i)=>{const v=s.querySelector("video");if(!v)return;if(i===index){v.play().catch(()=>{});}else{v.pause();try{v.currentTime=0;}catch(_){}}});}
function schedule(){clear();timer=setTimeout(()=>go(index+1,true),STEP_MS);}
function go(next,automatic=false){
if(locked)return;
if(next>=scenes.length)next=0;
if(next<0)next=scenes.length-1;
if(next===index){if(!automatic)schedule();return;}
locked=true;clear();
scenes[index].classList.remove("active");
index=next;scenes[index].classList.add("active");videos();
setTimeout(()=>{locked=false;schedule();},FADE_MS);
}
function start(e){const p=e.changedTouches?e.changedTouches[0]:e;touch={x:p.clientX,y:p.clientY};}
function end(e){if(!touch)return;const p=e.changedTouches?e.changedTouches[0]:e;const dx=p.clientX-touch.x,dy=p.clientY-touch.y;touch=null;if(Math.abs(dy)>42&&Math.abs(dy)>Math.abs(dx)*1.15)go(index+(dy<0?1:-1));}
window.addEventListener("touchstart",start,{passive:true});
window.addEventListener("touchend",end,{passive:true});
window.addEventListener("keydown",e=>{if(e.key==="ArrowDown"||e.key==="PageDown"){e.preventDefault();go(index+1);}else if(e.key==="ArrowUp"||e.key==="PageUp"){e.preventDefault();go(index-1);}});
document.addEventListener("visibilitychange",()=>{if(document.hidden)clear();else schedule();});
videos();schedule();
})();