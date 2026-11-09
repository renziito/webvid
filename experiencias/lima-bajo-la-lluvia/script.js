(()=> {
 const root=document.getElementById('webvid');
 const scenes=[...root.querySelectorAll('.scene')];
 const studioMode=new URLSearchParams(location.search).get('studio')==='1';
 let current=0,startY=0,startX=0,locked=false;

 function seekAnimations(progress){
   const animations=document.getAnimations({subtree:true});
   for(const animation of animations){
     const timing=animation.effect?.getTiming?.()||{};
     const duration=Number.isFinite(timing.duration)?timing.duration:0;
     if(duration>0){
       animation.pause();
       animation.currentTime=Math.max(0,Math.min(1,progress))*duration;
     }
   }
 }

 function showScene(index){
   const next=Math.max(0,Math.min(scenes.length-1,index));
   scenes.forEach((scene,i)=>scene.classList.toggle('active',i===next));
   current=next;
   if(scenes[current]._map){
     requestAnimationFrame(()=>scenes[current]._map.invalidateSize({pan:false}));
   }
   if(studioMode) seekAnimations(0);
 }

 function go(delta){
   if(locked)return;
   const next=Math.max(0,Math.min(scenes.length-1,current+delta));
   if(next===current)return;
   locked=true;
   showScene(next);
   setTimeout(()=>locked=false,850);
 }

 // One real street map per scene. Controls are intentionally hidden.
 function mountMaps(){
   if(!window.L)return;
   scenes.forEach(scene=>{
     const lat=Number(scene.dataset.lat),lon=Number(scene.dataset.lon),zoom=Number(scene.dataset.zoom||13);
     const holder=document.createElement('div');
     holder.className='map';
     scene.prepend(holder);
     const map=L.map(holder,{zoomControl:false,scrollWheelZoom:false,dragging:false,doubleClickZoom:false,keyboard:false,attributionControl:false}).setView([lat,lon],zoom);
     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:'abc'}).addTo(map);
     L.circleMarker([lat,lon],{radius:5,color:'#fff',weight:1,fillColor:'#ff755d',fillOpacity:1}).addTo(map);
     scene._map=map;
     requestAnimationFrame(()=>map.invalidateSize({pan:false}));
   });
 }

 if(studioMode){
   document.documentElement.classList.add('webvid-studio-preview');
   window.addEventListener('message',event=>{
     if(event.origin!==location.origin||event.source!==parent)return;
     const data=event.data;
     if(!data||data.channel!=='WEBVID_STUDIO_PREVIEW')return;
     if(data.type==='SET_SCENE'&&Number.isInteger(data.index))showScene(data.index);
     if(data.type==='SEEK'&&Number.isFinite(data.progress))seekAnimations(data.progress);
   });
 }else{
   root.addEventListener('touchstart',e=>{
     startY=e.touches[0].clientY;
     startX=e.touches[0].clientX;
   },{passive:true});
   root.addEventListener('touchend',e=>{
     const dy=e.changedTouches[0].clientY-startY;
     const dx=e.changedTouches[0].clientX-startX;
     if(Math.abs(dy)>48&&Math.abs(dy)>Math.abs(dx))go(dy<0?1:-1);
   },{passive:true});
   root.addEventListener('wheel',e=>{
     if(Math.abs(e.deltaY)>45)go(e.deltaY>0?1:-1);
   },{passive:true});
   window.addEventListener('keydown',e=>{
     if(e.key==='ArrowDown'||e.key==='PageDown')go(1);
     if(e.key==='ArrowUp'||e.key==='PageUp')go(-1);
   });
 }

 window.addEventListener('resize',()=>{
   scenes.forEach(scene=>{
     if(scene._map)scene._map.invalidateSize({pan:false});
   });
 });
 if(window.visualViewport){
   window.visualViewport.addEventListener('resize',()=>{
     scenes.forEach(scene=>{
       if(scene._map)scene._map.invalidateSize({pan:false});
     });
   });
 }
 mountMaps();
 if(studioMode)showScene(0);
})();
