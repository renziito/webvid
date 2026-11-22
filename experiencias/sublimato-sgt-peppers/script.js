(()=>{
"use strict";
const scenes=Array.from(document.querySelectorAll("#film .scene"));
if(!scenes.length)return;
const STEP_MS=3200;
let index=Math.max(0,scenes.findIndex(scene=>scene.classList.contains("active")));
let timer=null,deadline=0,remaining=STEP_MS,pointerStart=null;
scenes.forEach((scene,i)=>scene.classList.toggle("active",i===index));
function stopClock(){
  if(timer!==null){clearTimeout(timer);timer=null;}
  if(deadline)remaining=Math.max(0,deadline-Date.now());
  deadline=0;
}
function syncVideos(){
  scenes.forEach((scene,i)=>{
    const video=scene.querySelector("video");
    if(!video)return;
    if(i===index){const result=video.play();if(result&&result.catch)result.catch(()=>{});}
    else{video.pause();try{video.currentTime=0;}catch(error){}}
  });
}
function schedule(delay=STEP_MS){
  if(document.hidden)return;
  if(timer!==null)clearTimeout(timer);
  remaining=Math.max(0,delay);deadline=Date.now()+remaining;
  timer=setTimeout(()=>{timer=null;deadline=0;remaining=STEP_MS;show(index+1);},remaining);
}
function show(next){
  stopClock();
  index=(next+scenes.length)%scenes.length;
  scenes.forEach((scene,i)=>scene.classList.toggle("active",i===index));
  syncVideos();remaining=STEP_MS;schedule(STEP_MS);
}
const film=document.getElementById("film");
film.addEventListener("pointerdown",event=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  pointerStart={x:event.clientX,y:event.clientY};
},{passive:true});
film.addEventListener("pointerup",event=>{
  if(!pointerStart)return;
  const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;pointerStart=null;
  if(Math.abs(dy)>45&&Math.abs(dy)>Math.abs(dx)*1.15)show(index+(dy<0?1:-1));
},{passive:true});
film.addEventListener("pointercancel",()=>{pointerStart=null;},{passive:true});
window.addEventListener("keydown",event=>{
  if(event.key==="ArrowDown"||event.key==="PageDown"){event.preventDefault();show(index+1);}
  else if(event.key==="ArrowUp"||event.key==="PageUp"){event.preventDefault();show(index-1);}
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){stopClock();scenes.forEach(scene=>{const video=scene.querySelector("video");if(video)video.pause();});}
  else{syncVideos();schedule(remaining||STEP_MS);}
});
syncVideos();schedule(STEP_MS);
})();