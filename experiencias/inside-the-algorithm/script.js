(()=> {
'use strict';
const scenes=[...document.querySelectorAll('.scene')];
let current=0,startY=null,locked=false;
const studioMode=new URLSearchParams(location.search).get('studio')==='1';
function changeTo(index){
 const next=Math.max(0,Math.min(scenes.length-1,index));
 scenes.forEach((scene,i)=>scene.classList.toggle('active',i===next));
 current=next;
 if(studioMode) seekAnimations(0);
}
function change(delta){if(locked)return;const next=Math.max(0,Math.min(scenes.length-1,current+delta));if(next===current)return;locked=true;changeTo(next);setTimeout(()=>locked=false,700)}
function seekAnimations(progress){
 const animations=document.getAnimations({subtree:true});
 for(const animation of animations){
  const timing=animation.effect?.getTiming?.()||{};
  const duration=Number.isFinite(timing.duration)?timing.duration:0;
  if(duration>0){animation.pause();animation.currentTime=Math.max(0,Math.min(1,progress))*duration;}
 }
}
if(studioMode){
 document.documentElement.classList.add('webvid-studio-preview');
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  const data=event.data;
  if(!data||data.channel!=='WEBVID_STUDIO_PREVIEW')return;
  if(data.type==='SET_SCENE'&&Number.isInteger(data.index)){
   changeTo(data.index);
   seekAnimations(0);
  }
  if(data.type==='SEEK'&&Number.isFinite(data.progress))seekAnimations(data.progress);
 });
 changeTo(0);
 seekAnimations(0);
}else{
 addEventListener('touchstart',e=>{if(e.touches.length===1)startY=e.touches[0].clientY},{passive:true});
 addEventListener('touchend',e=>{if(startY===null)return;const diff=e.changedTouches[0].clientY-startY;startY=null;if(Math.abs(diff)>45)change(diff<0?1:-1)},{passive:true});
 addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>25)change(e.deltaY>0?1:-1)},{passive:true});
 addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='PageDown')change(1);if(e.key==='ArrowDown'||e.key==='PageUp')change(-1)});
}
})();