import {memo,type KeyboardEvent} from 'react';
import {blockLinkLabelPosition,type BlockDiagram,type BlockNode,type BlockRole,type BlockLink} from './blockDiagram';
import type {DiagramPort} from './schematic';

export type BlockSelection={kind:'node'|'link';id:string}|null;
export type BlockDrawingOptions={grid:boolean;signalNames:boolean};
const palette:Record<BlockRole,{color:string;fill:string}>={power:{color:'#ac8440',fill:'#fbf4e5'},input:{color:'#668fac',fill:'#edf5fa'},control:{color:'#438870',fill:'#edf7f2'},processing:{color:'#a18a5a',fill:'#f8f4e9'},output:{color:'#8c7ba8',fill:'#f3eff8'},support:{color:'#82949c',fill:'#f0f4f5'},generic:{color:'#8396a2',fill:'#eff3f6'}};
const paper='#fbfcfd',signal='#47738d',power='#b28a48',reference='#8f9e9b';
const short=(text:string,max:number)=>text.length>max?text.slice(0,max-1)+'\u2026':text;
const colorOf=(link:BlockLink)=>link.kind==='power'?power:link.kind==='ground'?reference:signal;
const wrap=(text:string)=>{if(text.length<=25)return [text];const last=text.lastIndexOf(' ',25),cut=last>10?last:25;return [text.slice(0,cut),short(text.slice(cut).trim(),26)]};
const css=`.bd-sheet text{font-family:Arial,Helvetica,sans-serif;fill:#284356;user-select:none}.bd-sheet .bd-mono{font-family:'IBM Plex Mono',Consolas,monospace}.bd-muted{opacity:.2}.bd-card[role=button],.bd-edge[role=button]{cursor:pointer}.bd-card:focus,.bd-edge:focus{outline:none}.bd-card:focus .bd-body{stroke:#298461;stroke-width:3}.bd-edge:focus .bd-line{stroke:#298461;stroke-width:3}.bd-title{font-size:16px;font-weight:600}.bd-ref{font-size:11px;fill:#7b919e!important}.bd-role{font-size:9px;letter-spacing:1px}.bd-summary{font-size:11px;fill:#78909e!important}.bd-caption{font-size:10px;letter-spacing:.6px;fill:#79909d!important}.bd-line{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.bd-name{font-size:11px;font-weight:600}.bd-detail{font-size:9px;fill:#8095a1!important}.bd-body{fill:white;stroke:#b8cad5;stroke-width:1.5}.bd-selected .bd-body{stroke:#328565;stroke-width:2.8}.bd-outline{fill:none;stroke:#bccdd8;stroke-width:1}`;

function RoleIcon({role,x,y}:{role:BlockRole;x:number;y:number}){
 const color=palette[role].color;
 return <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
  {role==='power'?<path d="M17 1L5 16h9l-3 13 14-18h-9Z"/>:role==='control'?<><rect x={6} y={6} width={18} height={18} rx={2}/><path d="M10 2v4m10-4v4M10 24v4m10-4v4M2 10h4m-4 10h4m18-10h4m-4 10h4"/><rect x={11} y={11} width={8} height={8}/></>:role==='processing'?<><rect x={3} y={6} width={25} height={19} rx={2}/><path d="M7 12h8m-3-3l3 3-3 3m11 4h-8m3-3l-3 3 3 3"/></>:role==='output'?<><circle cx={15} cy={15} r={12}/><path d="M7 15h16m-5-5l5 5-5 5"/></>:role==='input'?<><path d="M2 20h5l4-12 7 17 5-11h6"/><path d="M4 5l3 3m20-3l-3 3"/></>:role==='support'?<path d="M1 15h4l3-7 5 14 5-14 5 14 3-7h4"/>:<><rect x={3} y={3} width={10} height={10} rx={1}/><rect x={18} y={3} width={10} height={10} rx={1}/><rect x={3} y={18} width={10} height={10} rx={1}/><rect x={18} y={18} width={10} height={10} rx={1}/></>}
 </g>;
}
function Card({node,selected}:{node:BlockNode;selected:boolean}){
 const paletteRole=palette[node.role],lines=wrap(node.name);
 if(node.kind!=='component')return <>
  <rect className="bd-body" x={node.x} y={node.y} width={node.width} height={node.height} rx={5} style={{fill:node.kind==='reference-bus'?'#f0f4f3':paletteRole.fill,stroke:selected?'#328565':node.kind==='reference-bus'?'#91a29c':paletteRole.color}}/>
  <text x={node.x+16} y={node.y+30} fontSize={20} fontWeight={600}>{node.name}</text>
  <text className="bd-summary" x={node.x+16} y={node.y+53}>{node.summary}</text>
  <text className="bd-role bd-mono" x={node.x+node.width-15} y={node.y+24} textAnchor="end">{node.kind==='reference-bus'?'REFERENCE':'POWER'}</text>
 </>;
 let badgeX=node.x+18;
 return <>
  <rect className="bd-body" x={node.x} y={node.y} width={node.width} height={node.height} rx={5}/>
  <path d={`M${node.x+5},${node.y}h${node.width-10}q5,0 5,5v68H${node.x}V${node.y+5}q0,-5 5,-5`} fill={paletteRole.fill}/>
  <rect x={node.x+17} y={node.y+17} width={36} height={36} rx={5} fill="white" stroke={paletteRole.color} strokeOpacity={.3}/>
  <RoleIcon role={node.role} x={node.x+20} y={node.y+20}/>
  <text className="bd-role" x={node.x+65} y={node.y+24} style={{fill:paletteRole.color}}>{node.roleName.toUpperCase()}</text>
  {lines.map((line,i)=><text key={i} className="bd-title" x={node.x+65} y={node.y+47+i*19}>{line}</text>)}
  <text className="bd-ref bd-mono" x={node.x+node.width-14} y={node.y+17} textAnchor="end">{node.reference}</text>
  <text className="bd-summary" x={node.x+18} y={node.y+94}>{short([node.value,node.summary].filter(Boolean).join(' / '),43)}</text>
  {node.badges.map((badge,index)=>{
   const width=badge.name.length*6+19,x=badgeX;badgeX+=width+6;if(x+width>node.x+node.width-12)return null;
   return <g key={index}><rect x={x} y={node.y+node.height-34} width={width} height={20} rx={3} fill={badge.kind==='power'?'#fbf3e1':'#edf4ef'} stroke={badge.kind==='power'?'#e4d4b1':'#d0e0d5'}/><text x={x+width/2} y={node.y+node.height-20} textAnchor="middle" className="bd-mono" fontSize={10} style={{fill:badge.kind==='power'?'#a07b37':'#6f8b7b'}}>{badge.name}</text></g>;
  })}
 </>;
}

export const BlockDiagramDrawing=memo(function BlockDiagramDrawing({diagram,options,selection=null,onSelect}:{diagram:BlockDiagram;options:BlockDrawingOptions;selection?:BlockSelection;onSelect?:(selection:BlockSelection)=>void}){
 const selectedLinks=new Set(selection?.kind==='link'?[selection.id]:selection?.kind==='node'?diagram.links.filter(link=>link.from===selection.id||link.to===selection.id).map(link=>link.id):[]),activeNodes=new Set<string>(selection?.kind==='node'?[selection.id]:[]);
 for(const link of diagram.links)if(selectedLinks.has(link.id)){activeNodes.add(link.from);activeNodes.add(link.to)}
 const links=new Map(diagram.links.map(link=>[link.id,link])),netNames=new Map(diagram.networks.map(net=>[net.id,net.name])),muted=(id:string)=>!!selection&&!selectedLinks.has(id);
 const activate=(kind:'node'|'link',id:string)=>(event:KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSelect?.({kind,id})}};
 const arrow=(link:BlockLink,at:'from'|'to')=>link.direction==='both'||link.direction==='forward'&&at==='to'||link.direction==='reverse'&&at==='from';
 return <g className="bd-sheet" data-block-sheet="true">
  <style>{css}</style><defs>
   <pattern id="bd-grid" width={24} height={24} patternUnits="userSpaceOnUse"><circle cx={1} cy={1} r={.65} fill="#dce6ed"/></pattern>
   {['signal','power','ground'].map(kind=><marker key={kind} id={`bd-arrow-${kind}`} viewBox="0 0 10 8" refX={9} refY={4} markerWidth={9} markerHeight={8} orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0L10 4L0 8Z" fill={kind==='power'?power:kind==='ground'?reference:signal}/></marker>)}
  </defs>
  <rect width={diagram.drawing.width} height={diagram.drawing.height} fill={paper}/>
  {options.grid&&<rect x={32} y={98} width={diagram.drawing.width-64} height={diagram.drawing.height-226} fill="url(#bd-grid)"/>}
  <rect className="bd-outline" x={32} y={24} width={diagram.drawing.width-64} height={diagram.drawing.height-48}/>
  <text className="bd-caption bd-mono" x={64} y={49}>CIRCUIT STUDIO / SYSTEM BLOCK DIAGRAM</text><text x={64} y={78} fontSize={22} fontWeight={600}>{short(diagram.title,70)}</text>
  <text className="bd-caption bd-mono" x={diagram.drawing.width-64} y={52} textAnchor="end">{diagram.blocks.filter(b=>b.kind==='component').length} COMPONENT BLOCKS / {diagram.links.filter(l=>l.kind==='signal').length} SIGNAL LINKS</text>
  <text className="bd-caption bd-mono" x={diagram.drawing.width-64} y={76} textAnchor="end">FUNCTIONAL OVERVIEW / NOT TO SCALE</text>
  <line className="bd-outline" x1={32} x2={diagram.drawing.width-32} y1={98} y2={98}/>
  {diagram.blocks.some(block=>block.role==='power')&&<text className="bd-caption bd-mono" x={110} y={126}>POWER &amp; SHARED RAILS</text>}
  {diagram.lanes.map((lane,index)=><g key={index}><rect x={lane.x} y={lane.y} width={lane.width} height={lane.height} rx={7} fill={['#edf5fa','#eaf4f0','#f8f4e9','#f2eef7'][index%4]} fillOpacity={.48}/><text x={lane.x+17} y={lane.y+25} fontSize={12} fontWeight={600} fill="#80949f">{lane.name}</text></g>)}
  {diagram.drawing.routes.map((route,index)=>{const link=links.get(route.netId)!;return <g key={index} className={`bd-edge ${muted(link.id)?'bd-muted':''}`} data-block-link={link.id} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={`${link.label}: ${diagram.blocks.find(b=>b.id===link.from)?.name} to ${diagram.blocks.find(b=>b.id===link.to)?.name}`} onClick={event=>{event.stopPropagation();onSelect?.({kind:'link',id:link.id})}} onKeyDown={activate('link',link.id)}>
   <title>{`${link.label} / ${link.netIds.map(id=>netNames.get(id)).join(', ')}`}</title><path className="bd-line" d={route.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')} stroke={selectedLinks.has(link.id)?'#267c61':colorOf(link)} strokeWidth={selectedLinks.has(link.id)?3:2} strokeDasharray={link.kind==='power'?'7 5':link.kind==='ground'?'3 5':undefined}/><path d={route.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="transparent" strokeWidth={14}/>
  </g>})}
  {diagram.drawing.crossings.map((crossing,index)=>{const {x,y}=crossing.point,h=crossing.horizontal,over=links.get(crossing.over)!,under=links.get(crossing.under)!,d=h?`M${x-6},${y}Q${x},${y-10} ${x+6},${y}`:`M${x},${y-6}Q${x+10},${y} ${x},${y+6}`;return <g key={index} className={muted(over.id)&&muted(under.id)?'bd-muted':''} pointerEvents="none"><path d={h?`M${x-6},${y}h12`:`M${x},${y-6}v12`} stroke={paper} strokeWidth={5}/><path className="bd-line" stroke={colorOf(under)} d={h?`M${x},${y-6}v12`:`M${x-6},${y}h12`}/><path d={d} stroke={paper} strokeWidth={5} fill="none"/><path className="bd-line" stroke={colorOf(over)} d={d}/></g>})}
  {diagram.blocks.map(node=><g key={node.id} data-block-node={node.id} data-block-kind={node.kind} className={`bd-card ${selection?.kind==='node'&&selection.id===node.id?'bd-selected':''} ${selection&&!activeNodes.has(node.id)?'bd-muted':''}`} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={`${node.reference}: ${node.name}`} onClick={event=>{event.stopPropagation();onSelect?.({kind:'node',id:node.id})}} onKeyDown={activate('node',node.id)}>
   <title>{`${node.reference}: ${node.name} / ${node.roleName}${node.badges.length?' / '+node.badges.map(b=>b.name).join(', '):''}`}</title><Card node={node} selected={selection?.kind==='node'&&selection.id===node.id}/>
  </g>)}
  {diagram.drawing.nodes.flatMap(node=>node.ports.map((port:DiagramPort)=>{const link=links.get(port.netId!)!,at=port.pinId as 'from'|'to';return <line key={port.id} className={`bd-line ${muted(link.id)?'bd-muted':''}`} x1={port.point.x} y1={port.point.y} x2={port.inner.x} y2={port.inner.y} stroke={colorOf(link)} strokeDasharray={link.kind==='power'?'7 5':link.kind==='ground'?'3 5':undefined} markerEnd={arrow(link,at)?`url(#bd-arrow-${link.kind})`:undefined} pointerEvents="none"/>}))}
  {diagram.links.filter(link=>link.kind==='signal').map(link=>{const point=blockLinkLabelPosition(diagram,link);if(!point)return null;const names=link.netIds.map(id=>netNames.get(id)).filter(Boolean).join(', '),width=options.signalNames?Math.max(96,Math.min(164,names.length*5+16)):92,height=options.signalNames?37:24;return <g key={link.id} className={muted(link.id)?'bd-muted':''} pointerEvents="none"><rect x={point.x-width/2} y={point.y-height/2} width={width} height={height} rx={4} fill={paper} stroke="#d8e3eb"/><text className="bd-name" x={point.x} y={point.y+(options.signalNames?-3:4)} textAnchor="middle">{link.label}</text>{options.signalNames&&<text className="bd-detail bd-mono" x={point.x} y={point.y+12} textAnchor="middle">{short(names,28)}</text>}</g>})}
  {diagram.drawing.unrouted.flatMap(id=>diagram.drawing.nodes.flatMap(node=>node.ports.filter(p=>p.netId===id).map(port=><text key={port.id} x={port.point.x+(port.side==='left'?-6:6)} y={port.point.y-7} className="bd-name bd-mono" textAnchor={port.side==='left'?'end':'start'} fill={signal}>{id}</text>)))}
  {!!diagram.references.length&&<g><text className="bd-caption bd-mono" x={64} y={diagram.drawing.height-165}>SHARED REFERENCE</text><text x={64} y={diagram.drawing.height-145} fontSize={12}>{short(diagram.references.map(ref=>`${ref.name}: ${ref.blocks.join(', ')}`).join(' / '),Math.floor((diagram.drawing.width-128)/7))}</text></g>}
  <rect className="bd-outline" x={64} y={diagram.drawing.height-116} width={diagram.drawing.width-128} height={62}/>
  <text className="bd-caption bd-mono" x={80} y={diagram.drawing.height-95}>PROJECT CONNECTIONS, GROUPED FOR UNDERSTANDING</text><text x={80} y={diagram.drawing.height-73} fontSize={14}>{diagram.connectionCount} pin connections / {diagram.networks.length} electrical nets</text>
  <text className="bd-caption bd-mono" x={diagram.drawing.width-80} y={diagram.drawing.height-74} textAnchor="end">ARROWS: KNOWN PIN DIRECTION / PLAIN LINES: UNSPECIFIED</text>
 </g>;
});
