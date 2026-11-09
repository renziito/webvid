import { decodeAudioFile } from "./audio-analyzer.mjs";
import { renderDocumentFrame } from "./dom-renderer.mjs";

const MEDIABUNNY_URL = "https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/+esm";
const $ = selector => document.querySelector(selector);
let active = false;

const loadMediaBunny = () => import(MEDIABUNNY_URL);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const clock = seconds => {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const n = Math.round(seconds), h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
  return h ? [h, String(m).padStart(2,"0"), String(s).padStart(2,"0")].join(":")
    : [m, String(s).padStart(2,"0")].join(":");
};

function getRenderFrame() {
  try {
    const win = window.open("", "webvid-studio-render");
    if (!win || win.closed) return null;
    const frame = win.document.querySelector("#experienceFrame");
    if (!frame && win.location.href === "about:blank") win.close();
    return frame;
  } catch { return null; }
}

function sceneAtTime(time, cues, duration) {
  let index = 0;
  for (let i = 1; i < cues.length; i++) { if (time >= cues[i]) index = i; else break; }
  const start = cues[index] || 0, end = cues[index + 1] ?? duration;
  return { index, progress: end > start ? Math.max(0, Math.min(1, (time - start) / (end - start))) : 0 };
}

async function createDestination(slug) {
  const filename = slug + "-" + new Date().toISOString().slice(0,10) + ".mp4";
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Vídeo MP4", accept: { "video/mp4": [".mp4"] } }]
      });
      return { kind:"file", filename, writable: await handle.createWritable(),
        finish: async () => ({ filename, savedDirectly:true }) };
    } catch (error) { if (error?.name === "AbortError") throw error; }
  }
  if (navigator.storage?.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory(), name = "webvid-export-" + Date.now() + ".mp4";
      const handle = await root.getFileHandle(name, { create:true }), writable = await handle.createWritable();
      return {
        kind:"opfs", filename, writable,
        finish: async () => {
          const file = await handle.getFile();
          download(file, filename);
          try { await root.removeEntry(name); } catch {}
          return { filename, size:file.size, savedDirectly:false };
        },
        discard: async () => { try { await root.removeEntry(name); } catch {} }
      };
    } catch {}
  }
  return { kind:"memory", filename, writable:null };
}

async function renderMp4({ iframe, audioBuffer, cues, duration, destination, onProgress, onPhase }) {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined")
    throw new Error("Este navegador no ofrece WebCodecs. La exportación MP4 directa no está disponible.");
  const { Output, Mp4OutputFormat, BufferTarget, StreamTarget, CanvasSource, AudioBufferSource, Quality } = await loadMediaBunny();
  const width = 1080, height = 1920, fps = 30, canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const target = destination.kind === "memory" ? new BufferTarget()
    : new StreamTarget(destination.writable, { chunked:true, chunkSize:1024*1024 });
  const output = new Output({ format:new Mp4OutputFormat(), target });
  const video = new CanvasSource(canvas, { codec:"avc", quality:new Quality({bitrate:10_000_000}), transform:{frameRate:fps} });
  const audio = new AudioBufferSource({ codec:"aac", quality:new Quality({bitrate:192_000}), transform:{numberOfChannels:2,sampleRate:48_000} });
  output.addVideoTrack(video, {frameRate:fps}); output.addAudioTrack(audio);
  await output.start();
  try {
    onPhase("Escribiendo audio y preparando vídeo…");
    await audio.add(audioBuffer); audio.close();
    const totalFrames = Math.ceil(duration * fps), started = performance.now();
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps, scene = sceneAtTime(time, cues, duration);
      await renderDocumentFrame({ iframe, canvas, sceneIndex:scene.index, progress:scene.progress });
      await video.add(time, 1/fps);
      if (frame % 3 === 0 || frame === totalFrames - 1) {
        const fraction = (frame+1)/totalFrames, elapsed = (performance.now()-started)/1000;
        onProgress({fraction,elapsed,remaining:elapsed/fraction-elapsed,frame:frame+1,totalFrames,scene:scene.index+1,sceneCount:cues.length,mediaTime:Math.min(time,duration),duration});
        await wait(0);
      }
    }
    video.close();
    onPhase("Finalizando MP4 y escribiendo metadatos…");
    onProgress({fraction:0.97,finalizing:true});
    await output.finalize();
    if (destination.kind === "memory") {
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength < 1024) throw new Error("El archivo MP4 resultante está vacío.");
      return new Blob([buffer], {type:"video/mp4"});
    }
    return await destination.finish();
  } catch (error) {
    try { await output.cancel(); } catch {}
    if (destination.discard) await destination.discard();
    throw error;
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href=url; a.download=filename; a.style.display="none"; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),120000);
}

function updateProgress(info) {
  const bar=$("#exportProgress"), track=bar?.parentElement;
  if (info.finalizing) {
    if(bar) bar.style.width="97%";
    track?.setAttribute("aria-valuenow","97");
    $("#exportStatus").textContent="97% · Finalizando MP4 y escribiendo metadatos. Esta fase depende del codificador y del almacenamiento…";
    return;
  }
  const percent=Math.round(info.fraction*95), remaining=Number.isFinite(info.remaining)?" · Restante aprox. "+clock(info.remaining):"";
  if(bar) bar.style.width=(info.fraction*95)+"%";
  track?.setAttribute("aria-valuenow",String(percent));
  $("#exportStatus").textContent=percent+"% · Escena "+info.scene+"/"+info.sceneCount+
    " · Frame "+info.frame.toLocaleString("es-ES")+"/"+info.totalFrames.toLocaleString("es-ES")+
    " · Vídeo "+clock(info.mediaTime)+"/"+clock(info.duration)+
    " · Transcurrido "+clock(info.elapsed)+remaining;
}

async function handleExport(event) {
  if(active) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const file=$("#audioFile")?.files?.[0], iframe=getRenderFrame();
  const sliders=[...document.querySelectorAll("#sceneTimeline input[type=range]")];
  if(!file||!sliders.length){$("#exportStatus").textContent="Importa y analiza el audio antes de exportar.";return;}
  if(!iframe?.contentDocument?.documentElement){$("#exportStatus").textContent="Abre el lienzo de render y espera a que cargue la experiencia antes de exportar.";return;}
  active=true; const button=$("#export"), status=$("#exportStatus");
  button.disabled=true; $("#exportProgress").style.width="0%";
  let destination;
  try {
    status.textContent="Elige dónde guardar el MP4 o preparando almacenamiento local…";
    destination=await createDestination($("#experience")?.value||"webvid-video");
    status.textContent="Decodificando audio y preparando el render…";
    const audioBuffer=await decodeAudioFile(file), cues=[0,...sliders.slice(1).map(s=>Number(s.value))], duration=audioBuffer.duration;
    status.textContent=destination.kind==="memory"
      ?"Sin almacenamiento progresivo: se usará memoria y las exportaciones largas podrían agotar la RAM."
      :"Almacenamiento progresivo preparado. La duración depende de los recursos disponibles del dispositivo.";
    const result=await renderMp4({iframe,audioBuffer,cues,duration,destination,
      onPhase:message=>{status.textContent=message;},onProgress:updateProgress});
    if(result instanceof Blob){
      download(result,destination.filename);
      status.textContent="MP4 generado y descargado: "+destination.filename+" · "+(result.size/1048576).toFixed(1)+" MB.";
    } else {
      status.textContent=result.savedDirectly?"MP4 guardado correctamente: "+result.filename:
        "MP4 generado y descargado: "+result.filename+" · "+(result.size/1048576).toFixed(1)+" MB.";
    }
    $("#exportProgress").style.width="100%"; $("#exportProgress").parentElement?.setAttribute("aria-valuenow","100");
  } catch(error) {
    if(destination?.discard) await destination.discard();
    status.textContent=error?.name==="AbortError"?"Exportación cancelada.":(error.message||"No se pudo generar el MP4 directo.");
    $("#exportProgress").style.width="0%"; $("#exportProgress").parentElement?.setAttribute("aria-valuenow","0");
  } finally { active=false; button.disabled=false; }
}

document.addEventListener("click",event=>{if(event.target?.closest?.("#export"))handleExport(event);},true);
document.addEventListener("DOMContentLoaded",()=>{
  const status=$("#exportStatus");
  if(status) status.textContent="Exportación directa preparada. Sin límite fijo de duración; la capacidad depende del navegador y del almacenamiento disponible.";
});
