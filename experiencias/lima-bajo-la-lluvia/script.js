(()=> {
 const root=document.getElementById('webvid');
 const scenes=[...root.querySelectorAll('.scene')];
 let current=0,startY=0,startX=0,locked=false;
 // One real street map per scene. Controls are intentionally hidden.
 function mountMaps(){
   if(!window.L)return;
   scenes.forEach(scene=>{
     const lat=Number(scene.dataset.lat),lon=Number(scene.dataset.lon),zoom=Number(scene.dataset.zoom||13);
     const holder=document.createElement('div');holder.className='map';scene.prepend(holder);
     const map=L.map(holder,{zoomControl:false,scrollWheelZoom:false,dragging:false,doubleClickZoom:false,keyboard:false,attributionControl:false}).setView([lat,lon],zoom);
     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:'abc'}).addTo(map);
     L.circleMarker([lat,lon],{radius:5,color:'#fff',weight:1,fillColor:'#ff755d',fillOpacity:1}).addTo(map);
     scene._map=map;
     requestAnimationFrame(()=>map.invalidateSize({pan:false}));
   });
 }
 function go(delta){
   if(locked)return;
   const next=Math.max(0,Math.min(scenes.length-1,current+delta));
   if(next===current)return;
   locked=true;
   scenes[current].classList.remove('active');
   current=next;
   scenes[current].classList.add('active');
   if(scenes[current]._map){
     requestAnimationFrame(()=>{
       requestAnimationFrame(()=>{
         scenes[current]._map.invalidateSize({pan:false});
       });
     });
   }
   setTimeout(()=>locked=false,850);
 }
 root.addEventListener('touchstart',e=>{startY=e.touches[0].clientY;startX=e.touches[0].clientX},{passive:true});
 root.addEventListener('touchend',e=>{
   const dy=e.changedTouches[0].clientY-startY,dx=e.changedTouches[0].clientX-startX;
   if(Math.abs(dy)>48&&Math.abs(dy)>Math.abs(dx))go(dy<0?1:-1);
 },{passive:true});
 root.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>45)go(e.deltaY>0?1:-1)},{passive:true});
 window.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='PageDown')go(1);if(e.key==='ArrowUp'||e.key==='PageUp')go(-1)});

 window.addEventListener('resize',()=>{
   scenes.forEach(scene=>{
     if(scene._map) scene._map.invalidateSize({pan:false});
   });
 });
 if(window.visualViewport){
   window.visualViewport.addEventListener('resize',()=>{
     scenes.forEach(scene=>{
       if(scene._map) scene._map.invalidateSize({pan:false});
     });
   });
 }
 mountMaps();
})();
