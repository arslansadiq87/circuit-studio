import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArrowLeft,Check,ChevronRight,CircuitBoard,Download,Focus,Layers,Minus,MousePointer2,Plus,Printer,Search,X} from 'lucide-react';
import type {Project} from './model';
import {generateCircuitDiagram,type DiagramNode} from './schematic';
import {SchematicDrawing,type DiagramSelection} from './SchematicDrawing';
import './schematic.css';

type Camera={x:number;y:number;scale:number};
export function SchematicView({project,onClose,onLocate}:{project:Project;onClose:()=>void;onLocate:(id:string)=>void}){
 const [allPins,setAllPins]=useState(false),[powerSymbols,setPowerSymbols]=useState(true),[labelsOnly,setLabelsOnly]=useState(false),[grid,setGrid]=useState(true),[selection,setSelection]=useState<DiagramSelection>(null),[tab,setTab]=useState<'nets'|'parts'>('nets'),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[exporting,setExporting]=useState(false);
 const diagram=useMemo(()=>generateCircuitDiagram(project,{allPins,powerSymbols,labelsOnly}),[project,allPins,powerSymbols,labelsOnly]);
 const host=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),closeButton=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null),[size,setSize]=useState({width:1000,height:700}),[camera,setCamera]=useState<Camera>({x:0,y:0,scale:.5});
 const cameraRef=useRef(camera);cameraRef.current=camera;
 const drag=useRef<{id:number;x:number;y:number;camera:Camera}|null>(null);
 const options={powerSymbols,labelsOnly,grid};
 const fit=(bounds?:{x:number;y:number;width:number;height:number})=>{
  const box=bounds??{x:0,y:0,width:diagram.width,height:diagram.height},scale=Math.max(.08,Math.min(2.5,(size.width-64)/box.width,(size.height-64)/box.height));
  setCamera({scale,x:(size.width-box.width*scale)/2-box.x*scale,y:(size.height-box.height*scale)/2-box.y*scale});
 };
 useLayoutEffect(()=>{const element=host.current;if(!element)return;const observer=new ResizeObserver(entries=>{const rect=entries[0].contentRect;setSize({width:rect.width,height:rect.height})});observer.observe(element);return()=>observer.disconnect()},[]);
 useEffect(()=>{fit()},[diagram.width,diagram.height,size.width,size.height]);
 useEffect(()=>{
  const before=document.activeElement;closeButton.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();onClose()}
   if(event.key==='Tab'){
    const items=[...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
   }
  };
  window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('keydown',key,true);if(before instanceof HTMLElement)before.focus()};
 },[onClose]);
 useEffect(()=>{
  const element=svg.current;if(!element)return;
  const wheel=(event:WheelEvent)=>{event.preventDefault();const rect=element.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,old=cameraRef.current,scale=Math.max(.08,Math.min(4,old.scale*Math.exp(-event.deltaY*.0015)));setCamera({scale,x:x-(x-old.x)*scale/old.scale,y:y-(y-old.y)*scale/old.scale})};
  element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
 },[]);
 const zoom=(factor:number)=>{const old=cameraRef.current,scale=Math.max(.08,Math.min(4,old.scale*factor)),x=size.width/2,y=size.height/2;setCamera({scale,x:x-(x-old.x)*scale/old.scale,y:y-(y-old.y)*scale/old.scale})};
 const focusNodes=(nodes:DiagramNode[])=>{if(!nodes.length)return;const x=Math.min(...nodes.map(n=>n.x))-100,y=Math.min(...nodes.map(n=>n.y))-100;fit({x,y,width:Math.max(...nodes.map(n=>n.x+n.width))-x+100,height:Math.max(...nodes.map(n=>n.y+n.height))-y+100})};
 const choose=(value:DiagramSelection,focus=false)=>{setSelection(value);if(focus&&value)focusNodes(diagram.nodes.filter(node=>value.kind==='node'?node.id===value.id:node.ports.some(port=>port.netId===value.id)))};
 const node=selection?.kind==='node'?diagram.nodes.find(n=>n.id===selection.id):undefined,net=selection?.kind==='net'?diagram.nets.find(n=>n.id===selection.id):undefined;
 const notify=(text:string)=>{setMessage(text);window.setTimeout(()=>setMessage(''),3500)};
 const filename=project.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-schematic';
 const serialized=()=>`<?xml version="1.0" encoding="UTF-8"?>\n`+renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={diagram.width} height={diagram.height} viewBox={`0 0 ${diagram.width} ${diagram.height}`}><title>{project.name} - circuit schematic</title><SchematicDrawing diagram={diagram} options={options}/></svg>);
 const download=(blob:Blob,extension:string)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${filename}.${extension}`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const exportSvg=()=>{download(new Blob([serialized()],{type:'image/svg+xml;charset=utf-8'}),'svg');notify('Schematic exported as SVG')};
 const exportPng=async()=>{
  setExporting(true);let url:string|undefined;
  try{url=URL.createObjectURL(new Blob([serialized()],{type:'image/svg+xml;charset=utf-8'}));const image=new Image();image.src=url;await image.decode();const scale=Math.min(2,8192/diagram.width,8192/diagram.height,Math.sqrt(20000000/(diagram.width*diagram.height))),canvas=document.createElement('canvas');canvas.width=Math.ceil(diagram.width*scale);canvas.height=Math.ceil(diagram.height*scale);const context=canvas.getContext('2d');if(!context)throw new Error('PNG export is unavailable');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not create image')),'image/png'));download(blob,'png');notify('Schematic exported as PNG')}
  catch(error){notify(error instanceof Error?error.message:'Could not export schematic')}
  finally{if(url)URL.revokeObjectURL(url);setExporting(false)}
 };
 const print=()=>{
  const popup=window.open('','_blank','width=1200,height=850');if(!popup){notify('Allow pop-ups to print the schematic');return}
  popup.document.open();popup.document.write(`<!doctype html><html><head><title>Circuit schematic</title><style>@page{size:landscape;margin:8mm}body{margin:0;background:white}svg{width:100%;height:auto;max-height:95vh}@media print{svg{max-height:95vh}}</style></head><body>${serialized().replace(/^<\?xml[^>]+>\s*/,'')}</body></html>`);popup.document.close();popup.focus();popup.setTimeout(()=>popup.print(),350);
 };
 const query=search.trim().toLowerCase(),searchablePorts=new Map(diagram.nodes.flatMap(node=>node.ports.map(port=>[port.id,`${node.reference} ${node.name} ${port.label} ${port.pinId}`] as const))),filteredNets=diagram.nets.filter(n=>`${n.name} ${n.ports.map(id=>searchablePorts.get(id)).join(' ')}`.toLowerCase().includes(query)),filteredNodes=diagram.nodes.filter(n=>`${n.reference} ${n.name} ${n.value} ${n.ports.map(p=>p.label).join(' ')}`.toLowerCase().includes(query));
 return <section className="schematic-overlay" role="dialog" aria-modal="true" aria-labelledby="schematic-title" ref={dialog}>
  <header className="schematic-head">
   <div className="schematic-brand"><span className="schematic-brand-icon"><CircuitBoard size={22}/></span><div><span className="schematic-eyebrow">CIRCUIT STUDIO</span><h1 id="schematic-title">Circuit schematic</h1></div><span className="schematic-project">{project.name}</span></div>
   <div className="schematic-head-actions"><button onClick={print} disabled={!diagram.nodes.length}><Printer size={15}/> Print / PDF</button><button onClick={exportSvg} disabled={!diagram.nodes.length}><Download size={15}/> SVG</button><button onClick={()=>void exportPng()} disabled={exporting||!diagram.nodes.length}><Download size={15}/> {exporting?'Exporting...':'PNG'}</button><span/><button ref={closeButton} className="schematic-back" onClick={onClose}><ArrowLeft size={15}/> Back to 3D</button></div>
  </header>
  <div className="schematic-toolbar">
   <div className="schematic-live"><span/> Generated from current project <span className="schematic-count">{diagram.nodes.length} parts / {diagram.nets.length} nets</span></div>
   <div className="schematic-options"><label><input type="checkbox" checked={allPins} onChange={e=>setAllPins(e.target.checked)}/> All pins</label><label><input type="checkbox" checked={powerSymbols} onChange={e=>setPowerSymbols(e.target.checked)}/> Power symbols</label><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Grid</label><select aria-label="Schematic connections" value={labelsOnly?'labels':'wires'} onChange={e=>setLabelsOnly(e.target.value==='labels')}><option value="wires">Routed wires</option><option value="labels">Net labels</option></select><button onClick={()=>fit()} aria-label="Fit schematic"><Focus size={15}/> Fit sheet</button></div>
  </div>
  <div className="schematic-body">
   <div className="schematic-canvas" ref={host}>
    {diagram.nodes.length?<svg ref={svg} width="100%" height="100%" aria-label="Generated 2D circuit diagram" onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{
     if(e.button!==1&&e.button!==2&&(e.target as Element).closest('[data-schematic-node],[data-schematic-net]'))return;
     drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,camera:cameraRef.current};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('is-panning');
    }} onPointerMove={e=>{const start=drag.current;if(start)setCamera({...start.camera,x:start.camera.x+e.clientX-start.x,y:start.camera.y+e.clientY-start.y})}} onPointerUp={e=>{const start=drag.current;if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<3)setSelection(null);drag.current=null;e.currentTarget.classList.remove('is-panning');if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{drag.current=null;svg.current?.classList.remove('is-panning')}}>
     <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}><SchematicDrawing diagram={diagram} options={options} selection={selection} onSelect={choose}/></g>
    </svg>:<div className="schematic-empty"><CircuitBoard size={42}/><h2>Your circuit diagram starts with a component</h2><p>Add components and connections in the 3D workspace. Their symbols, pin names, and nets will appear here automatically.</p><button onClick={onClose}><ArrowLeft size={15}/> Return to 3D</button></div>}
    <div className="schematic-zoom"><button onClick={()=>zoom(1/1.2)} aria-label="Zoom out schematic"><Minus size={16}/></button><button className="schematic-zoom-value" onClick={()=>fit()} title="Fit sheet">{Math.round(camera.scale*100)}%</button><button onClick={()=>zoom(1.2)} aria-label="Zoom in schematic"><Plus size={16}/></button></div>
    <div className="schematic-gesture"><MousePointer2 size={13}/> Drag empty space to pan. Scroll to zoom.</div>
    {message&&<div className="schematic-notice" role="status"><Check size={15}/>{message}</div>}
   </div>
   <aside className="schematic-navigator" aria-label="Schematic navigator">
    <div className="schematic-nav-head"><span className="schematic-eyebrow">CIRCUIT INDEX</span><h2>Explore the diagram</h2><p>Select a net or component to trace its connections.</p></div>
    <div className="schematic-search"><Search size={14}/><input aria-label="Search schematic" placeholder="Find a net, pin, or component..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="schematic-tabs"><button className={tab==='nets'?'active':''} onClick={()=>setTab('nets')}>Nets <span>{diagram.nets.length}</span></button><button className={tab==='parts'?'active':''} onClick={()=>setTab('parts')}>Components <span>{diagram.nodes.length}</span></button></div>
    <div className="schematic-index">
     {tab==='nets'?filteredNets.map(item=><button key={item.id} className={`schematic-net-row ${selection?.id===item.id?'selected':''}`} onClick={()=>choose({kind:'net',id:item.id},true)}><span className={`schematic-net-dot ${item.kind}`}/><span><strong>{item.name}</strong><small>{item.kind==='ground'?'Ground':item.kind==='power'?'Power':'Signal'} / {item.ports.length} pins</small></span><ChevronRight size={13}/></button>):filteredNodes.map(item=><button key={item.id} className={`schematic-part-row ${selection?.id===item.id?'selected':''}`} onClick={()=>choose({kind:'node',id:item.id},true)}><span className="schematic-ref-badge">{item.reference}</span><span><strong>{item.name}</strong><small>{item.totalPins} pins{item.value?' / '+item.value:''}</small></span><ChevronRight size={13}/></button>)}
     {(tab==='nets'?!filteredNets.length:!filteredNodes.length)&&<p className="schematic-no-results">{query?'No matching connections or components.':'No connections yet. Add wiring in 3D to create nets.'}</p>}
    </div>
    {selection&&<div className="schematic-details">
     <div className="schematic-detail-title"><span className="schematic-eyebrow">{node?'COMPONENT':'ELECTRICAL NET'}</span><button onClick={()=>setSelection(null)} aria-label="Clear schematic selection"><X size={14}/></button></div>
     <h3>{node?`${node.reference} / ${node.name}`:net?.name}</h3>
     {node?<><p>{node.ports.filter(p=>p.netId).length} connected pins / {node.totalPins} total</p><button className="schematic-locate" onClick={()=>{onLocate(node.id);onClose()}}><Layers size={14}/> Select in 3D</button></>:net?.ports.map(id=>{const component=diagram.nodes.find(n=>n.ports.some(p=>p.id===id))!,pin=component.ports.find(p=>p.id===id)!;return <button key={id} className="schematic-terminal-row" onClick={()=>choose({kind:'node',id:component.id},true)}><span>{component.reference}</span><div><strong>{pin.label}</strong><small>{component.name} / {pin.pinId}</small></div></button>})}
    </div>}
    <div className="schematic-legend"><span><i/> Joined connection</span><span><svg width="23" height="12"><path d="M0 9h6q5-12 10 0h7" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> Crossing / not joined</span><p>{diagram.issues.length?`${diagram.issues.length} connection issue${diagram.issues.length===1?'':'s'}: ${diagram.issues.join(' ')}`:diagram.unrouted.length?`${diagram.unrouted.length} nets use matching labels where wires would be crowded.`:'Pin names and connections follow your project. Shared labels identify the same electrical net.'}</p></div>
   </aside>
  </div>
  <footer className="schematic-footer"><span><span className="schematic-status-dot"/> {diagram.connectionCount} connections represented</span><span>2D schematic / independent of the 3D wire shape</span><span>SVG + PNG / print to PDF</span></footer>
 </section>;
}
