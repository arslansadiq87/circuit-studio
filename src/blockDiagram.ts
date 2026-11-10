import type {Component,Pin,Project} from './model';
import {diagramPinKey,generateCircuitDiagram,routeDiagram,type CircuitDiagram,type DiagramNet,type DiagramNode,type DiagramPort,type DiagramPoint} from './schematic';

export type BlockRole='power'|'input'|'control'|'processing'|'output'|'support'|'generic';
export type BlockNode={id:string;reference:string;name:string;role:BlockRole;roleName:string;value:string;summary:string;kind:'component'|'power-bus'|'reference-bus';x:number;y:number;width:number;height:number;netIds:string[];badges:{name:string;kind:'power'|'ground'}[]};
export type BlockLink={id:string;from:string;to:string;kind:'signal'|'power'|'ground';direction:'forward'|'reverse'|'both'|'none';label:string;netIds:string[];wireIds:string[];connections:{from:string;fromPin:string;to:string;toPin:string;netName:string}[]};
export type BlockDiagram={title:string;blocks:BlockNode[];links:BlockLink[];networks:DiagramNet[];references:{name:string;blocks:string[]}[];lanes:{name:string;x:number;y:number;width:number;height:number}[];drawing:CircuitDiagram;connectionCount:number;issues:string[]};
export type BlockOptions={powerLinks?:boolean;referenceLinks?:boolean};
export const blockRoleNames:Record<BlockRole,string>={power:'Power source',input:'Input / sensing',control:'Controller',processing:'Driver / logic',output:'Output / actuator',support:'Supporting circuit',generic:'Circuit block'};
const natural=(a:string,b:string)=>a.localeCompare(b,undefined,{numeric:true});
function roleOf(component:Component):BlockRole{
 const model=component.modelId.toLowerCase(),category=(component.geometry?.category??'').toLowerCase();
 if(/supply|dc-source|battery|power-source/.test(model))return 'power';
 if(/esp32|arduino|microcontroller|raspberry|\bmcu\b/.test(model+' '+category))return 'control';
 if(/motor|stepper|servo|buzzer|speaker|\bled\b|display|lamp/.test(model))return 'output';
 if(/sensor|\bldr\b|photo|thermistor|switch|button|potentiometer/.test(model+' '+category))return 'input';
 if(/resistor|capacitor|inductor|diode/.test(model))return 'support';
 if(/driver|interface|converter/.test(model+' '+category)||component.pins.some(p=>/^IN\d+$/i.test(p.label))&&component.pins.some(p=>/^OUT\d+$/i.test(p.label)))return 'processing';
 return 'generic';
}
const pinDirection=(pin:Pin):'in'|'out'|'unknown'=>/^(output|digital-output|analog-output)$/i.test(pin.electrical??'')||/^OUT\d*$/i.test(pin.label)?'out':/^(input|digital-input|analog-input)$/i.test(pin.electrical??'')||/^IN\d*$/i.test(pin.label)?'in':'unknown';
const direction=(a:Pin,b:Pin)=>{const from=pinDirection(a),to=pinDirection(b);return from==='out'&&to!=='out'||to==='in'&&from!=='in'?'forward':to==='out'&&from!=='out'||from==='in'&&to!=='in'?'reverse':'none'};

/** A general component-level graph, derived from electrical connections, not 3D routes. */
export function generateBlockDiagram(project:Project,options:BlockOptions={}):BlockDiagram{
 const source=generateCircuitDiagram(project,{allPins:true,labelsOnly:true}),components=new Map(project.components.map(c=>[c.id,c])),sourceNodes=new Map(source.nodes.map(n=>[n.id,n]));
 const netByWire=new Map(source.nets.flatMap(net=>net.wireIds.map(id=>[id,net] as const))),netByPort=new Map(source.nets.flatMap(net=>net.ports.map(id=>[id,net] as const)));
 const blocks:BlockNode[]=project.components.map(component=>{
  const symbol=sourceNodes.get(component.id)!,role=roleOf(component),nets=source.nets.filter(n=>n.ports.some(id=>symbol.ports.some(p=>p.id===id))),signals=nets.filter(n=>n.kind==='signal').length;
  return {id:component.id,reference:symbol.reference,name:component.name||symbol.reference,role,roleName:blockRoleNames[role],value:symbol.value,summary:signals?`${signals} signal net${signals===1?'':'s'}`:nets.length?'Power / reference connections':'Not connected',kind:'component',x:0,y:0,width:292,height:150,netIds:nets.map(n=>n.id),badges:nets.filter(n=>n.kind!=='signal').map(n=>({name:n.name,kind:n.kind as 'power'|'ground'}))};
 });
 const nodeMap=new Map(blocks.map(b=>[b.id,b])),linkGroups=new Map<string,BlockLink&{directions:Set<string>}>();
 for(const wire of project.wires){
  const net=netByWire.get(wire.id);if(!net||net.kind!=='signal')continue;
  const a=components.get(wire.from.componentId)!,b=components.get(wire.to.componentId)!,pa=a.pins.find(p=>p.id===wire.from.pinId)!,pb=b.pins.find(p=>p.id===wire.to.pinId)!;
  const [from,to]=[a.id,b.id].sort(),key=JSON.stringify([from,to]),link=linkGroups.get(key)??{id:`link-${linkGroups.size+1}`,from,to,kind:'signal',direction:'none',label:'',netIds:[],wireIds:[],connections:[],directions:new Set<string>()};
  const flow=direction(pa,pb),normalized=a.id===from?flow:flow==='forward'?'reverse':flow==='reverse'?'forward':'none';link.directions.add(normalized);
  if(!link.netIds.includes(net.id))link.netIds.push(net.id);link.wireIds.push(wire.id);link.connections.push({from:a.id,fromPin:pa.label,to:b.id,toPin:pb.label,netName:net.name});linkGroups.set(key,link);
 }
 const signalLinks:BlockLink[]=[...linkGroups.values()].map(({directions,...link})=>({...link,direction:directions.has('none')?'none':directions.size>1?'both':directions.has('forward')?'forward':'reverse',label:link.netIds.length>1?`${link.netIds.length} signals`:'Signal'}));
 const neighbors=new Map<string,Set<string>>();for(const link of signalLinks){for(const [a,b] of [[link.from,link.to],[link.to,link.from]]){const set=neighbors.get(a)??new Set();if(a!==b)set.add(b);neighbors.set(a,set)}}
 for(const block of blocks){const powerPorts=options.powerLinks===false?0:block.badges.filter(b=>b.kind==='power').length,referencePorts=options.referenceLinks?block.badges.filter(b=>b.kind==='ground').length:0;block.height=Math.max(150,((neighbors.get(block.id)?.size??0)+powerPorts+referencePorts)*24+54)}
 const anchor=blocks.find(b=>b.role==='control')??[...blocks].filter(b=>b.role!=='power').sort((a,b)=>(neighbors.get(b.id)?.size??0)-(neighbors.get(a.id)?.size??0)||natural(a.reference,b.reference))[0];
 const hops=new Map<string,number>();if(anchor){hops.set(anchor.id,0);const queue=[anchor.id];for(let i=0;i<queue.length;i++)for(const id of neighbors.get(queue[i])??[])if(!hops.has(id)){hops.set(id,hops.get(queue[i])!+1);queue.push(id)}}
 const ranks=new Map<string,number>();let isolated=0;
 for(const block of blocks){const rank=block.role==='power'?-1:block.role==='input'||block.role==='support'?0:block.role==='control'?1:block.role==='processing'?(block.id===anchor?.id?1:2):block.role==='output'?3:block.id===anchor?.id?1:hops.has(block.id)?Math.min(3,1+hops.get(block.id)!):isolated++%3;ranks.set(block.id,rank)}
 const activeRanks=[...new Set([...ranks.values()].filter(rank=>rank>=0))].sort(),columns=activeRanks.map(rank=>blocks.filter(block=>ranks.get(block.id)===rank));
 // Put related outputs in the same vertical order as their driver blocks.
 for(const column of columns)column.sort((a,b)=>{
  const related=(node:BlockNode)=>[...(neighbors.get(node.id)??[])].map(id=>nodeMap.get(id)!.reference).sort(natural)[0]??node.reference;
  return a.role==='output'&&b.role==='output'?natural(related(a),related(b)):natural(a.reference,b.reference);
 });
 const powers=source.nets.filter(net=>net.kind==='power'),grounds=source.nets.filter(net=>net.kind==='ground'),sources=blocks.filter(b=>b.role==='power');
 const powerVisible=options.powerLinks!==false,groundVisible=!!options.referenceLinks;
 const mainWidth=Math.max(1080,activeRanks.length*440+200),busPerRow=Math.max(1,Math.floor((mainWidth-560)/280)),powerRows=powerVisible?Math.ceil(powers.length/busPerRow):0;
 const sourceHeight=sources.reduce((sum,block)=>sum+block.height,0)+Math.max(0,sources.length-1)*40;
 const powerHeight=sources.length||powerRows?Math.max(sourceHeight+114,powerRows*190+48):0,mainTop=148+powerHeight;
 const columnHeight=(column:BlockNode[])=>column.reduce((sum,block)=>sum+block.height,0)+Math.max(0,column.length-1)*122;
 const mainHeight=Math.max(280,...columns.map(columnHeight));
 let sourceY=142;for(const block of sources){block.x=110;block.y=sourceY;sourceY+=block.height+40}
 const lanes:BlockDiagram['lanes']=columns.map((column,index)=>{
  let y=mainTop+(mainHeight-columnHeight(column))/2;
  for(const block of column){block.x=110+index*440;block.y=y;y+=block.height+122}
  const roleSet=new Set(column.map(b=>b.role)),name=roleSet.has('control')?'Control':roleSet.has('processing')?'Drivers & logic':roleSet.has('output')?'Outputs':roleSet.has('input')?'Inputs & sensing':roleSet.has('support')?'Supporting circuit':'Circuit blocks';
  return {name,x:90+index*440,y:mainTop-44,width:332,height:mainHeight+75};
 });
 const links=[...signalLinks],buses:BlockNode[]=[];
 const addBus=(net:DiagramNet,index:number,reference:boolean)=>{
  const ids=[...new Set(net.ports.map(id=>source.nodes.find(n=>n.ports.some(p=>p.id===id))!.id))],id=`bus-${net.id}`;
  const bus:BlockNode={id,reference:reference?'REF':'POWER',name:net.name,role:'power',roleName:reference?'Shared reference':'Power distribution',value:'',summary:`${ids.length} component${ids.length===1?'':'s'}`,kind:reference?'reference-bus':'power-bus',x:reference?150+(index%Math.max(1,Math.floor(mainWidth/300)))*300:530+(index%busPerRow)*280,y:reference?mainTop+mainHeight+95+Math.floor(index/Math.max(1,Math.floor(mainWidth/300)))*110:181+Math.floor(index/busPerRow)*190,width:220,height:72,netIds:[net.id],badges:[]};buses.push(bus);
  const hasProducer=ids.some(id=>nodeMap.get(id)!.role==='power'||components.get(id)!.pins.some(pin=>netByPort.get(diagramPinKey(id,pin.id))?.id===net.id&&/power[- ]?out/i.test(pin.electrical??'')));
  for(const componentId of ids){const component=components.get(componentId)!,pins=component.pins.filter(pin=>net.ports.includes(diagramPinKey(component.id,pin.id))),producer=nodeMap.get(componentId)!.role==='power'||pins.some(pin=>/power[- ]?out/i.test(pin.electrical??''));
   links.push({id:`${id}-${componentId}`,from:producer?componentId:id,to:producer?id:componentId,kind:reference?'ground':'power',direction:reference||!hasProducer?'none':'forward',label:net.name,netIds:[net.id],wireIds:[...net.wireIds],connections:pins.map(pin=>({from:componentId,fromPin:pin.label,to:id,toPin:net.name,netName:net.name}))});
  }
 };
 if(powerVisible)powers.forEach((net,index)=>addBus(net,index,false));if(groundVisible)grounds.forEach((net,index)=>addBus(net,index,true));
 const allNodes=[...blocks,...buses],drawingNodes:DiagramNode[]=allNodes.map(block=>({id:block.id,reference:block.reference,name:block.name,value:block.value,kind:'module',x:block.x,y:block.y,width:block.width,height:block.height,rank:ranks.get(block.id)??-1,totalPins:components.get(block.id)?.pins.length??0,ports:[]}));
 const byId=new Map(drawingNodes.map(n=>[n.id,n]));
 const ends=new Map<string,{link:BlockLink;at:'from'|'to';side:DiagramPort['side'];other:DiagramNode}[]>();
 for(const link of links){const a=byId.get(link.from)!,b=byId.get(link.to)!;
  for(const [node,other,at] of [[a,b,'from'],[b,a,'to']] as const){
   const dx=other.x+other.width/2-node.x-node.width/2,dy=other.y+other.height/2-node.y-node.height/2;
   const side:DiagramPort['side']=a===b?'right':link.kind!=='signal'&&nodeMap.get(node.id)?.role!=='power'&&nodeMap.get(other.id)?.role!=='power'?(dy>=0?'bottom':'top'):Math.abs(dx)>=Math.abs(dy)?dx>=0?'right':'left':dy>=0?'bottom':'top';
   const list=ends.get(node.id)??[];list.push({link,at,side,other});ends.set(node.id,list);
  }
 }
 for(const node of drawingNodes)for(const side of ['left','right','top','bottom'] as const){
  const list=(ends.get(node.id)??[]).filter(e=>e.side===side).sort((a,b)=>(side==='left'||side==='right'?a.other.y-b.other.y:a.other.x-b.other.x)||natural(a.link.id,b.link.id));
  list.forEach((end,index)=>{
   const vertical=side==='top'||side==='bottom',spacing=Math.min(24,((vertical?node.width:node.height)-64)/Math.max(1,list.length-1)),offset=(index-(list.length-1)/2)*spacing,x=vertical?node.x+node.width/2+offset:node.x+(side==='right'?node.width:0),y=vertical?node.y+(side==='bottom'?node.height:0):node.y+node.height/2+offset;
   node.ports.push({id:`${end.link.id}:${end.at}`,componentId:node.id,pinId:end.at,label:end.link.label,number:'',side,inner:{x,y},point:{x:x+(side==='left'?-28:side==='right'?28:0),y:y+(side==='top'?-28:side==='bottom'?28:0)},netId:end.link.id});
  });
 }
 const width=Math.max(mainWidth,...allNodes.map(n=>n.x+n.width+90)),height=Math.max(mainTop+mainHeight+260,...buses.map(n=>n.y+n.height+175));
 const drawing:CircuitDiagram={title:project.name,nodes:drawingNodes,nets:links.map(link=>({id:link.id,name:link.label,kind:'signal',ports:[`${link.id}:from`,`${link.id}:to`],wireIds:link.wireIds,color:link.kind==='power'?'#b58b43':link.kind==='ground'?'#91a29e':'#4c7d9c'})),routes:[],junctions:[],crossings:[],width,height,issues:[...source.issues],unrouted:[],connectionCount:source.connectionCount};
 routeDiagram(drawing,false);
 return {title:project.name,blocks:allNodes,links,networks:source.nets,references:grounds.map(net=>({name:net.name,blocks:[...new Set(net.ports.map(id=>source.nodes.find(n=>n.ports.some(p=>p.id===id))!.reference))]})),lanes,drawing,connectionCount:source.connectionCount,issues:source.issues};
}

export function blockLinkLabelPosition(diagram:BlockDiagram,link:BlockLink):DiagramPoint|undefined{
 const segments=diagram.drawing.routes.filter(r=>r.netId===link.id).flatMap(route=>route.points.slice(1).map((b,i)=>({a:route.points[i],b})));
 const ordered=segments.sort((a,b)=>((b.a.y===b.b.y?2:1)*(Math.abs(b.a.x-b.b.x)+Math.abs(b.a.y-b.b.y)))-((a.a.y===a.b.y?2:1)*(Math.abs(a.a.x-a.b.x)+Math.abs(a.a.y-a.b.y))));
 for(const segment of ordered){const horizontal=segment.a.y===segment.b.y,point={x:(segment.a.x+segment.b.x)/2+(horizontal?0:48),y:(segment.a.y+segment.b.y)/2};if(Math.abs(segment.a.x-segment.b.x)+Math.abs(segment.a.y-segment.b.y)<48)continue;if(!diagram.blocks.some(b=>point.x+58>b.x-6&&point.x-58<b.x+b.width+6&&point.y+18>b.y-6&&point.y-18<b.y+b.height+6))return point}
 return undefined;
}
