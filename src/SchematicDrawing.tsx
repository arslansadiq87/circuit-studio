import type {CircuitDiagram,DiagramNode,DiagramPort,DiagramNet} from './schematic';

export type DiagramSelection={kind:'node'|'net';id:string}|null;
export type DrawingOptions={powerSymbols:boolean;labelsOnly:boolean;grid:boolean};
type Props={diagram:CircuitDiagram;options:DrawingOptions;selection?:DiagramSelection;onSelect?:(selection:DiagramSelection)=>void};
const ink='#233b4d',wireInk='#426e86',accent='#24795f',paper='#fbfcfd';
const style=`.sch-sheet text{font-family:Arial,Helvetica,sans-serif;fill:${ink};user-select:none}.sch-sheet .sch-mono{font-family:'IBM Plex Mono',Consolas,monospace}.sch-wire{fill:none;stroke:${wireInk};stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.sch-wire.sch-active{stroke:${accent};stroke-width:2.8}.sch-muted{opacity:.2}.sch-body{fill:#fff;stroke:${ink};stroke-width:1.8}.sch-node.sch-selected .sch-body{stroke:${accent};stroke-width:2.7}.sch-node[role=button],.sch-net[role=button]{cursor:pointer}.sch-node:focus,.sch-net:focus{outline:none}.sch-node:focus .sch-body{stroke:${accent};stroke-width:3}.sch-net:focus .sch-wire{stroke:${accent};stroke-width:3}.sch-pin{fill:none;stroke:${ink};stroke-width:1.5}.sch-pin-name{font-size:12px}.sch-pin-number{font-size:9px;fill:#728493!important}.sch-ref{font-size:17px;font-weight:700;letter-spacing:.5px}.sch-name{font-size:15px;font-weight:600}.sch-value{font-size:12px}.sch-caption{font-size:10px;fill:#6c8190!important;letter-spacing:.6px}.sch-net-label{font-size:11px;fill:${wireInk}!important;font-weight:600}.sch-power{fill:none;stroke:${wireInk};stroke-width:1.7}.sch-sheet .sch-active-label{fill:${accent}!important}.sch-grid{stroke:#cddbe5;stroke-width:.5}.sch-outline{fill:none;stroke:#b6c8d5;stroke-width:1}.sch-light-line{stroke:#d9e2e9;stroke-width:1}.sch-nc{stroke:#8b9ba6;stroke-width:1.2}`;
const short=(name:string,count=28)=>name.length>count?name.slice(0,count-1)+'\u2026':name;

function Port({port,node,net,options,fallback,active}:{port:DiagramPort;node:DiagramNode;net?:DiagramNet;options:DrawingOptions;fallback:boolean;active:boolean}){
 const {point,inner,side}=port,vertical=side==='top'||side==='bottom',two=node.kind==='resistor'||node.kind==='ldr'||node.kind==='led'||node.kind==='supply';
 const delta={x:side==='left'?-1:side==='right'?1:0,y:side==='top'?-1:side==='bottom'?1:0};
 const labelX=vertical?inner.x+(two?13:0):inner.x+(side==='left'?12:-12),labelY=vertical?(two?(side==='top'?node.y+28:node.y+node.height-20):inner.y+(side==='top'?17:-12)):inner.y+4;
 const folded=options.powerSymbols&&net&&net.kind!=='signal';
 const tag=net&&(options.labelsOnly||fallback)&&!folded;
 return <g data-schematic-pin={port.id}>
  <title>{`${node.reference} ${node.name} / ${port.label} [${port.pinId}]${net?' / '+net.name:' / unconnected'}`}</title>
  <line className="sch-pin" x1={inner.x} y1={inner.y} x2={point.x} y2={point.y}/>
  <text className="sch-pin-name sch-mono" x={labelX} y={labelY} textAnchor={vertical?(two?'start':'middle'):side==='left'?'start':'end'}>{short(port.label,19)}</text>
  {!two&&<text className="sch-pin-number sch-mono" x={vertical?point.x+7:(point.x+inner.x)/2} y={vertical?(point.y+inner.y)/2:point.y-5} textAnchor={vertical?'start':'middle'}>{port.number}</text>}
  {!net?<path className="sch-nc" d={`M${point.x-3},${point.y-3}l6,6m-6,0l6,-6`}/>:<circle cx={point.x} cy={point.y} r={1.7} fill={active?accent:wireInk}/>}
  {folded&&<g className={active?'sch-active-label':''}>
   {!vertical?<>
    <line className="sch-power" x1={point.x} y1={point.y} x2={point.x+delta.x*10} y2={point.y}/>
    <text className="sch-net-label sch-mono" x={point.x+delta.x*15} y={point.y+4} textAnchor={side==='left'?'end':'start'} stroke={paper} strokeWidth={4} paintOrder="stroke">{net.name}</text>
   </>:net.kind==='ground'?<>
    <path className="sch-power" d={`M${point.x},${point.y}v10m-10,0h20m-16,5h12m-9,5h6`}/>
    <text className="sch-net-label sch-mono" x={point.x} y={point.y+35} textAnchor="middle">{net.name}</text>
   </>:<>
    <path className="sch-power" d={`M${point.x},${point.y}v-13m-6,6l6,-6l6,6`}/>
    <text className="sch-net-label sch-mono" x={point.x} y={point.y-21} textAnchor="middle">{net.name}</text>
   </>}
  </g>}
  {tag&&<g>
   <line className="sch-wire" x1={point.x} y1={point.y} x2={point.x+delta.x*16} y2={point.y+delta.y*16}/>
   <text className={`sch-net-label sch-mono ${active?'sch-active-label':''}`} x={point.x+delta.x*21} y={point.y+delta.y*21+(vertical?(side==='bottom'?10:0):4)} textAnchor={vertical?'middle':side==='left'?'end':'start'} stroke={paper} strokeWidth={4} paintOrder="stroke">{net.name}</text>
  </g>}
 </g>;
}

function Symbol({node}:{node:DiagramNode}){
 const x=node.x+node.width/2,y=node.y+node.height/2;
 if(node.kind==='module'||node.kind==='motor')return <>
  <rect className="sch-body" x={node.x} y={node.y} width={node.width} height={node.height} rx={2}/>
  <line className="sch-light-line" x1={node.x} x2={node.x+node.width} y1={node.y+55} y2={node.y+55}/>
  <text className="sch-ref sch-mono" x={node.x} y={node.y-15}>{node.reference}</text>
  <text className="sch-name" x={x} y={node.y+38} textAnchor="middle">{short(node.name,29)}</text>
  {node.kind==='motor'&&<><circle cx={node.x+node.width-56} cy={y+14} r={34} fill="none" stroke={ink} strokeWidth={1.8}/><text x={node.x+node.width-56} y={y+24} textAnchor="middle" fontSize={27}>M</text><text className="sch-caption" x={node.x+node.width-56} y={y+67} textAnchor="middle">STEPPER</text></>}
  {!node.totalPins&&<text className="sch-caption" x={x} y={y+12} textAnchor="middle">NO DEFINED PINS</text>}
 </>;
 return <>
  <text className="sch-ref sch-mono" x={x+38} y={y-13}>{node.reference}</text>
  <text className="sch-value sch-mono" x={x+38} y={y+9}>{node.kind==='ldr'?'LDR':node.value}</text>
  {node.kind==='resistor'||node.kind==='ldr'?<>
   <rect className="sch-body" x={x-10} y={y-28} width={20} height={56}/>
   {node.kind==='ldr'&&<><circle cx={x} cy={y} r={41} fill="none" stroke={ink} strokeWidth={1.5}/><path d={`M${x-48},${y-52}l23,23m-7,-1l7,1l-1,-7m-7,-23l23,23m-7,-1l7,1l-1,-7`} fill="none" stroke={ink} strokeWidth={1.7}/></>}
  </>:node.kind==='led'?<>
   <path className="sch-body" d={`M${x},${y-28}v11m-14,0h28l-14,27Z M${x-16},${y+14}h32 M${x},${y+14}v14`}/>
   <path d={`M${x+19},${y-12}l20,-20m-7,1l7,-1l-1,7m-10,-2l20,-20m-7,1l7,-1l-1,7`} fill="none" stroke={ink} strokeWidth={1.7}/>
  </>:<><circle className="sch-body" cx={x} cy={y} r={30}/><path d={`M${x-7},${y-11}h14m-7,-7v14m-7,17h14`} stroke={ink} fill="none" strokeWidth={1.6}/></>}
 </>;
}

export function SchematicDrawing({diagram,options,selection=null,onSelect}:Props){
 const netMap=new Map(diagram.nets.map(n=>[n.id,n])),selectedNode=selection?.kind==='node'?diagram.nodes.find(n=>n.id===selection.id):undefined;
 const activeNets=new Set(selection?.kind==='net'?[selection.id]:selectedNode?.ports.flatMap(p=>p.netId?[p.netId]:[])??[]);
 const muted=(netId:string)=>!!selection&&!activeNets.has(netId);
 return <g className="sch-sheet" data-schematic-sheet="true">
  <style>{style}</style>
  <defs><pattern id="sch-paper-grid" width={20} height={20} patternUnits="userSpaceOnUse"><circle cx={1} cy={1} r={.65} fill="#dce6ed"/></pattern></defs>
  <rect width={diagram.width} height={diagram.height} fill={paper}/>
  {options.grid&&<rect x={36} y={96} width={diagram.width-72} height={diagram.height-236} fill="url(#sch-paper-grid)"/>}
  <rect className="sch-outline" x={32} y={24} width={diagram.width-64} height={diagram.height-48}/>
  <text className="sch-caption sch-mono" x={64} y={49}>CIRCUIT STUDIO / ELECTRICAL SCHEMATIC</text>
  <text x={64} y={78} fontSize={22} fontWeight={600}>{short(diagram.title,72)}</text>
  <text className="sch-caption sch-mono" x={diagram.width-64} y={51} textAnchor="end">{diagram.nodes.length} COMPONENTS / {diagram.nets.length} NETS</text>
  <text className="sch-caption sch-mono" x={diagram.width-64} y={75} textAnchor="end">LOGICAL CONNECTIONS / NOT TO SCALE</text>
  <line className="sch-outline" x1={32} x2={diagram.width-32} y1={96} y2={96}/>
  {Array.from({length:Math.max(1,Math.floor((diagram.width-64)/350))},(_,i)=><text key={i} className="sch-caption sch-mono" x={170+i*350} y={diagram.height-34} textAnchor="middle">{i+1}</text>)}
  {diagram.routes.map((route,i)=><g key={i} className={`sch-net ${muted(route.netId)?'sch-muted':''}`} data-schematic-net={route.netId} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={`Net ${netMap.get(route.netId)?.name}`} onClick={e=>{e.stopPropagation();onSelect?.({kind:'net',id:route.netId})}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onSelect?.({kind:'net',id:route.netId})}}}>
   <title>{netMap.get(route.netId)?.name}</title>
   <path d={route.points.map((p,index)=>`${index?'L':'M'}${p.x},${p.y}`).join(' ')} className={`sch-wire ${activeNets.has(route.netId)?'sch-active':''}`}/>
   <path d={route.points.map((p,index)=>`${index?'L':'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="transparent" strokeWidth={12}/>
  </g>)}
  {diagram.crossings.map((crossing,i)=>{
   const {x,y}=crossing.point,h=crossing.horizontal,under=netMap.get(crossing.under),over=netMap.get(crossing.over),d=h?`M${x-6},${y}Q${x},${y-10} ${x+6},${y}`:`M${x},${y-6}Q${x+10},${y} ${x},${y+6}`;
   return <g key={i} className={muted(crossing.over)&&muted(crossing.under)?'sch-muted':''} pointerEvents="none">
    <title>{`${over?.name} crosses ${under?.name}; not connected`}</title>
    <path d={h?`M${x-6},${y}h12`:`M${x},${y-6}v12`} stroke={paper} strokeWidth={5}/>
    <path d={h?`M${x},${y-6}v12`:`M${x-6},${y}h12`} className={`sch-wire ${activeNets.has(crossing.under)?'sch-active':''}`}/>
    <path d={d} fill="none" stroke={paper} strokeWidth={5}/><path d={d} className={`sch-wire ${activeNets.has(crossing.over)?'sch-active':''}`}/>
   </g>;
  })}
  {diagram.junctions.map((junction,i)=><circle key={i} className={muted(junction.netId)?'sch-muted':''} cx={junction.point.x} cy={junction.point.y} r={3.3} fill={activeNets.has(junction.netId)?accent:wireInk}><title>{`Connected: ${netMap.get(junction.netId)?.name}`}</title></circle>)}
  {diagram.nodes.map(node=><g key={node.id} data-schematic-node={node.id} className={`sch-node ${selection?.kind==='node'&&selection.id===node.id?'sch-selected':''} ${selection&&selection.id!==node.id&&!node.ports.some(p=>p.netId&&activeNets.has(p.netId))?'sch-muted':''}`} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={`${node.reference}: ${node.name}`} onClick={e=>{e.stopPropagation();onSelect?.({kind:'node',id:node.id})}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onSelect?.({kind:'node',id:node.id})}}}>
   <title>{`${node.reference} / ${node.name} / ${node.totalPins} pins`}</title><Symbol node={node}/>
   {node.ports.map(port=><Port key={port.id} node={node} port={port} net={netMap.get(port.netId??'')} options={options} fallback={diagram.unrouted.includes(port.netId??'')} active={!!port.netId&&activeNets.has(port.netId)}/>)}
  </g>)}
  <rect className="sch-outline" x={64} y={diagram.height-122} width={diagram.width-128} height={68}/>
  <line className="sch-outline" x1={diagram.width-220} x2={diagram.width-220} y1={diagram.height-122} y2={diagram.height-54}/>
  <text className="sch-caption sch-mono" x={80} y={diagram.height-103}>PROJECT</text><text x={80} y={diagram.height-78} fontSize={16}>{short(diagram.title,70)}</text>
  <text className="sch-caption sch-mono" x={diagram.width-245} y={diagram.height-79} textAnchor="end">{diagram.connectionCount} WIRE CONNECTIONS / DOTS JOIN / BRIDGES CROSS</text>
  <text className="sch-caption sch-mono" x={diagram.width-141} y={diagram.height-102} textAnchor="middle">SHEET</text><text className="sch-mono" x={diagram.width-141} y={diagram.height-77} textAnchor="middle" fontSize={18}>1 / 1</text>
 </g>;
}
