(()=>{
  "use strict";
  const scenes=Array.from(document.querySelectorAll(".scene"));
  if(!scenes.length)return;
  let current=Math.max(0,scenes.findIndex(s=>s.classList.contains("active")));
  let timer=null,locked=false,startX=0,startY=0;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function readingDuration(scene){
    const copy=scene.querySelector(".copy");
    const words=(copy?.innerText||"").trim().split(/\s+/).filter(Boolean).length;
    const requested=Number(scene.dataset.duration)||0;
    return Math.max(requested,Math.ceil((words/2.7)*1000+4500),12000);
  }
  function stopTimer(){if(timer){clearTimeout(timer);timer=null;}}
  function schedule(){
    stopTimer();
    if(current===scenes.length-1)return;
    timer=setTimeout(()=>show(current+1,true),readingDuration(scenes[current]));
  }
  function updateVideos(){
    scenes.forEach((scene,index)=>{
      const video=scene.querySelector("video");
      if(!video)return;
      if(index===current){video.play().catch(()=>{});}
      else{video.pause();try{video.currentTime=0;}catch{}}
    });
  }
  function show(index,automatic=false){
    if(locked)return;
    const next=clamp(index,0,scenes.length-1);
    if(next===current&&automatic)return;
    if(next===current){schedule();return;}
    locked=true;stopTimer();
    scenes[current].classList.remove("active");
    current=next;scenes[current].classList.add("active");
    updateVideos();
    window.setTimeout(()=>{locked=false;schedule();},760);
  }
  function point(e){const p=e.changedTouches?.[0]||e;return{x:p.clientX,y:p.clientY};}
  function down(e){const p=point(e);startX=p.x;startY=p.y;}
  function up(e){
    const p=point(e),dx=p.x-startX,dy=p.y-startY;
    if(Math.abs(dy)>42&&Math.abs(dy)>Math.abs(dx)*1.15)show(current+(dy<0?1:-1));
  }
  window.addEventListener("touchstart",down,{passive:true});
  window.addEventListener("touchend",up,{passive:true});
  window.addEventListener("pointerdown",down,{passive:true});
  window.addEventListener("pointerup",up,{passive:true});
  window.addEventListener("keydown",e=>{
    if(["ArrowDown","PageDown"," "].includes(e.key)){e.preventDefault();show(current+1);}
    if(["ArrowUp","PageUp"].includes(e.key)){e.preventDefault();show(current-1);}
  });
  scenes.forEach((scene,index)=>{if(index!==current)scene.classList.remove("active");});
  scenes[current].classList.add("active");
  updateVideos();schedule();
})();