import type {Component,Pin,Project} from './model';

export type DiagramPoint={x:number;y:number};
export type DiagramKind='module'|'resistor'|'ldr'|'led'|'motor'|'supply';
export type DiagramPort={id:string;componentId:string;pinId:string;label:string;number:string;side:'left'|'right'|'top'|'bottom';point:DiagramPoint;inner:DiagramPoint;netId?:string};
export type DiagramNode={id:string;reference:string;name:string;value:string;kind:DiagramKind;x:number;y:number;width:number;height:number;rank:number;ports:DiagramPort[];totalPins:number};
export type DiagramNet={id:string;name:string;kind:'signal'|'ground'|'power';ports:string[];wireIds:string[];color:string};
export type DiagramRoute={netId:string;points:DiagramPoint[]};
export type DiagramCrossing={point:DiagramPoint;over:string;under:string;horizontal:boolean};
export type CircuitDiagram={title:string;nodes:DiagramNode[];nets:DiagramNet[];routes:DiagramRoute[];junctions:{netId:string;point:DiagramPoint}[];crossings:DiagramCrossing[];width:number;height:number;issues:string[];unrouted:string[];connectionCount:number};
export type DiagramOptions={allPins?:boolean;powerSymbols?:boolean;labelsOnly?:boolean};
export const diagramPinKey=(componentId:string,pinId:string)=>JSON.stringify([componentId,pinId]);
const natural=(a:string,b:string)=>a.localeCompare(b,undefined,{numeric:true});
const distance=(a:DiagramPoint,b:DiagramPoint)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const kindOf=(component:Component):DiagramKind=>component.modelId==='resistor'?'resistor':component.modelId==='ldr'?'ldr':component.modelId==='led'?'led':/stepper|motor/i.test(component.modelId)?'motor':/supply|dc-source/i.test(component.modelId)?'supply':'module';
const isGround=(pin:Pin)=>pin.electrical==='ground'||/^(GND|GROUND|VSS)(\b|\s|_)/i.test(pin.label);
const isPower=(pin:Pin)=>/power[- ]?(in|out)|supply/i.test(pin.electrical??'')||/^(VCC|VDD|VIN|VBUS|BAT\+|OUT\+|\+?\d+(?:[.V]\d+)?\s*V|3V3|5V|12V)(\b|\s|_)/i.test(pin.label);
const refPrefix=(kind:DiagramKind,component:Component)=>kind==='resistor'||kind==='ldr'?'R':kind==='led'?'D':kind==='motor'?'M':kind==='supply'?'V':/usb|connector|breadboard/i.test(component.modelId)?'J':'U';
const resistance=(ohms:number)=>ohms>=1e6?`${Number((ohms/1e6).toPrecision(4))} M\u03a9`:ohms>=1e3?`${Number((ohms/1e3).toPrecision(4))} k\u03a9`:`${ohms} \u03a9`;

/** Electrical topology only: 3D routes, visibility, rotations and positions do not change a net. */
export function generateCircuitDiagram(project:Project,options:DiagramOptions={}):CircuitDiagram{
 const components=new Map(project.components.map(c=>[c.id,c])),pins=new Map<string,{component:Component;pin:Pin}>();
 for(const component of project.components)for(const pin of component.pins)pins.set(diagramPinKey(component.id,pin.id),{component,pin});
 const parents=new Map<string,string>(),find=(key:string):string=>{const parent=parents.get(key);if(!parent){parents.set(key,key);return key}if(parent===key)return key;const root=find(parent);parents.set(key,root);return root};
 const valid:typeof project.wires=[],issues:string[]=[];
 for(const wire of project.wires){const a=diagramPinKey(wire.from.componentId,wire.from.pinId),b=diagramPinKey(wire.to.componentId,wire.to.pinId);
  if(!pins.has(a)||!pins.has(b)){issues.push(`Connection ${wire.label||wire.id} references a missing pin.`);continue}
  parents.set(find(a),find(b));valid.push(wire);
 }
 const groups=new Map<string,{ports:Set<string>;wireIds:string[];labels:string[];color:string}>();
 for(const wire of valid){const a=diagramPinKey(wire.from.componentId,wire.from.pinId),b=diagramPinKey(wire.to.componentId,wire.to.pinId),key=find(a),group=groups.get(key)??{ports:new Set<string>(),wireIds:[],labels:[],color:wire.color};group.ports.add(a);group.ports.add(b);group.wireIds.push(wire.id);if(wire.label&&!/^(New signal|Wire\s*\d*|Connection\s*\d*)$/i.test(wire.label))group.labels.push(wire.label);groups.set(key,group)}
 const connected=new Set([...groups.values()].flatMap(g=>[...g.ports]));
 const neighbors=new Map<string,Set<string>>();for(const wire of valid){for(const [a,b] of [[wire.from.componentId,wire.to.componentId],[wire.to.componentId,wire.from.componentId]]){const set=neighbors.get(a)??new Set();set.add(b);neighbors.set(a,set)}}
 const controllers=project.components.filter(c=>/esp32|arduino|microcontroller/i.test(c.modelId));
 const fallback=controllers.length?undefined:[...project.components].filter(c=>kindOf(c)==='module').sort((a,b)=>(neighbors.get(b.id)?.size??0)-(neighbors.get(a.id)?.size??0)||b.pins.length-a.pins.length)[0];
 const rankOf=(component:Component)=>kindOf(component)==='motor'?3:kindOf(component)!=='module'?0:controllers.some(c=>c.id===component.id)||fallback?.id===component.id?1:2;
 const counts=new Map<string,number>(),references=new Map<string,string>();
 for(const component of project.components){const prefix=refPrefix(kindOf(component),component),number=(counts.get(prefix)??0)+1;counts.set(prefix,number);references.set(component.id,`${prefix}${number}`)}
 const orderedGroups=[...groups.values()].sort((a,b)=>[...a.ports].sort().join('|').localeCompare([...b.ports].sort().join('|')));
 const groundGroups=orderedGroups.filter(g=>[...g.ports].some(id=>isGround(pins.get(id)!.pin)));
 const usedNames=new Set<string>();
 const nets:DiagramNet[]=orderedGroups.map((group,index)=>{
  const terminals=[...group.ports].map(id=>pins.get(id)!),ground=terminals.some(t=>isGround(t.pin)),power=terminals.some(t=>isPower(t.pin));
  const kind=ground&&!power?'ground':power&&!ground?'power':'signal';
  if(ground&&power)issues.push(`Net N${String(index+1).padStart(3,'0')} contains both supply and ground pins.`);
  let name=kind==='ground'?(groundGroups.length===1?'GND':`GND_${groundGroups.indexOf(group)+1}`):'';
  if(kind==='power'){
   const voltages=[...new Set(terminals.filter(t=>isPower(t.pin)).map(t=>t.pin.voltage).filter((v):v is number=>v!==undefined&&v>0))];
   name=voltages.length===1?`${voltages[0]}V`:terminals.find(t=>isPower(t.pin))!.pin.label.replace(/\s*(OUT|IN)$/i,'');
  }
  if(!name)name=group.labels[0]??terminals.find(t=>/^(GPIO\d+|SDA|SCL|TX|RX)\b/i.test(t.pin.label))?.pin.label??`N${String(index+1).padStart(3,'0')}`;
  name=name.replace(/\s+/g,'_');const base=name;let suffix=2;while(usedNames.has(name))name=`${base}_${suffix++}`;usedNames.add(name);
  return {id:`net-${index+1}`,name,kind,ports:[...group.ports].sort(),wireIds:group.wireIds,color:group.color};
 });
 const netByPort=new Map(nets.flatMap(net=>net.ports.map(id=>[id,net] as const)));
 const partner=(componentId:string,pinId:string)=>valid.flatMap(w=>w.from.componentId===componentId&&w.from.pinId===pinId?[w.to]:w.to.componentId===componentId&&w.to.pinId===pinId?[w.from]:[]);
 const nodes:DiagramNode[]=project.components.map(component=>{
  const kind=kindOf(component),rank=rankOf(component),used=component.pins.filter(p=>connected.has(diagramPinKey(component.id,p.id))),visible=options.allPins||!used.length?component.pins:used;
  const twoTerminal=(kind==='resistor'||kind==='ldr'||kind==='led'||kind==='supply')&&component.pins.length<=2;
  const sides=new Map<Pin,DiagramPort['side']>();
  for(const pin of visible){let side:DiagramPort['side'];
   if(twoTerminal)side=kind==='supply'&&isGround(pin)?'bottom':kind==='supply'&&isPower(pin)?'top':component.pins.indexOf(pin)===0?'top':'bottom';
   else if(kind==='motor')side='left';
   else if(isGround(pin))side='bottom';else if(isPower(pin))side='top';
   else if(/^IN\d*$/i.test(pin.label)||pin.electrical==='input')side='left';else if(/^OUT\d*$/i.test(pin.label)||pin.electrical==='output')side='right';
   else {const targets=partner(component.id,pin.id).map(p=>components.get(p.componentId)).filter((c):c is Component=>!!c),average=targets.length?targets.reduce((sum,c)=>sum+rankOf(c),0)/targets.length:rank;side=average>rank?'right':average<rank?'left':pin.side==='right'?'right':'left'}sides.set(pin,side);
  }
  const sorted=(side:DiagramPort['side'])=>visible.filter(p=>sides.get(p)===side).sort((a,b)=>{
   if(rank===1){const aPartner=partner(component.id,a.id)[0],bPartner=partner(component.id,b.id)[0];const order=natural(references.get(aPartner?.componentId)??'',references.get(bPartner?.componentId)??'');if(order)return order}
   return natural(a.label,b.label)||a.index-b.index;
  });
  const left=sorted('left'),right=sorted('right'),top=sorted('top'),bottom=sorted('bottom');
  const width=twoTerminal?190:kind==='motor'?260:rank===1?330:290,height=twoTerminal?166:Math.max(kind==='motor'?230:180,Math.max(left.length,right.length)*28+112);
  const ports:DiagramPort[]=[];
  for(const [side,list] of [['left',left],['right',right],['top',top],['bottom',bottom]] as const)list.forEach((pin,index)=>{
   const x=side==='left'?0:side==='right'?width:width*(index+1)/(list.length+1),y=side==='top'?0:side==='bottom'?height:84+index*28;
   const point={x:x+(side==='left'?-28:side==='right'?28:0),y:y+(side==='top'?-28:side==='bottom'?28:0)};
   const inner=twoTerminal?{x:width/2,y:height/2+(side==='top'?-28:28)}:{x,y};
   ports.push({id:diagramPinKey(component.id,pin.id),componentId:component.id,pinId:pin.id,label:pin.label,number:String(pin.physicalPosition??(pin.id.startsWith('PAD-')?'PAD':pin.id.replace(/^P(?=\d)/,''))),side,point,inner,netId:netByPort.get(diagramPinKey(component.id,pin.id))?.id});
  });
  const value=kind==='resistor'?resistance(component.resistanceOhms??1000):kind==='supply'?`${component.outputVoltage??component.pins.find(p=>p.voltage&&p.voltage>0)?.voltage??5} V DC`:kind==='ldr'?'Light dependent resistor':kind==='led'?'LED':kind==='motor'?`${component.pins.length}-wire stepper`:'';
  return {id:component.id,reference:references.get(component.id)!,name:component.name,value,kind,x:0,y:0,width,height,rank,ports,totalPins:component.pins.length};
 });
 const ranks=[...new Set(nodes.map(n=>n.rank))].sort(),columns=ranks.map(rank=>nodes.filter(n=>n.rank===rank));
 const columnHeight=(column:DiagramNode[])=>column.reduce((sum,n)=>sum+n.height,0)+Math.max(0,column.length-1)*144;
 const contentHeight=Math.max(360,...columns.map(columnHeight));
 columns.forEach((column,index)=>{
  if(column[0]?.rank===3)column.sort((a,b)=>{
   const connectedReference=(node:DiagramNode)=>[...(neighbors.get(node.id)??[])].map(id=>references.get(id)??'').sort(natural)[0]??node.reference;
   return natural(connectedReference(a),connectedReference(b));
  });
  let y=148+(contentHeight-columnHeight(column))/2;
  for(const node of column){node.x=120+index*470;node.y=y;y+=node.height+144;for(const port of node.ports){port.point={x:port.point.x+node.x,y:port.point.y+node.y};port.inner={x:port.inner.x+node.x,y:port.inner.y+node.y}}}
 });
 const width=Math.max(1000,160+Math.max(0,...nodes.map(n=>n.x+n.width))),height=contentHeight+354;
 const diagram:CircuitDiagram={title:project.name,nodes,nets,routes:[],junctions:[],crossings:[],width,height,issues,unrouted:[],connectionCount:valid.length};
 if(!options.labelsOnly)routeDiagram(diagram,options.powerSymbols!==false);
 return diagram;
}

type Box={left:number;right:number;top:number;bottom:number};
const pointKey=(point:DiagramPoint)=>`${point.x},${point.y}`;
const compact=(points:DiagramPoint[])=>{const result:DiagramPoint[]=[];for(const point of points){if(result.length&&pointKey(result.at(-1)!)===pointKey(point))continue;while(result.length>1){const a=result.at(-2)!,b=result.at(-1)!;if(a.x===b.x&&b.x===point.x||a.y===b.y&&b.y===point.y)result.pop();else break}result.push(point)}return result};
class DiagramHeap{
 items:{id:number;cost:number}[]=[];
 push(id:number,cost:number){let i=this.items.length;this.items.push({id,cost});while(i>0){const p=(i-1)>>1;if(this.items[p].cost<=cost)break;this.items[i]=this.items[p];i=p}this.items[i]={id,cost}}
 pop(){const first=this.items[0],last=this.items.pop()!;if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].cost<this.items[c].cost)c++;if(this.items[c].cost>=last.cost)break;this.items[i]=this.items[c];i=c}this.items[i]=last}return first}
}
export function routeDiagram(diagram:CircuitDiagram,powerSymbols:boolean){
 const ports=new Map(diagram.nodes.flatMap(node=>node.ports.map(port=>[port.id,port] as const))),boxes:Box[]=diagram.nodes.map(n=>({left:n.x-32,right:n.x+n.width+32,top:n.y-32,bottom:n.y+n.height+32}));
 const allPorts=[...ports.values()];
 const escape=(port:DiagramPort):DiagramPoint=>({x:port.point.x+(port.side==='left'?-20:port.side==='right'?20:0),y:port.point.y+(port.side==='top'?-20:port.side==='bottom'?20:0)});
 if(powerSymbols)for(const port of allPorts){const net=diagram.nets.find(n=>n.id===port.netId);if(!net||net.kind==='signal')continue;if(port.side==='top')boxes.push({left:port.point.x-42,right:port.point.x+42,top:port.point.y-36,bottom:port.point.y-2});else if(port.side==='bottom')boxes.push({left:port.point.x-38,right:port.point.x+38,top:port.point.y+5,bottom:port.point.y+43})}
 const xs=[...new Set([48,diagram.width-48,...allPorts.flatMap(p=>[p.point.x,escape(p).x]),...boxes.flatMap(b=>[b.left-10,b.left-26,b.left-42,b.right+10,b.right+26,b.right+42])])].filter(v=>v>=36&&v<=diagram.width-36).sort((a,b)=>a-b);
 const ys=[...new Set([108,diagram.height-150,...allPorts.flatMap(p=>[p.point.y,escape(p).y]),...boxes.flatMap(b=>[b.top-10,b.top-26,b.bottom+10,b.bottom+26])])].filter(v=>v>=100&&v<=diagram.height-140).sort((a,b)=>a-b),ny=ys.length;
 const index=(point:DiagramPoint)=>xs.indexOf(point.x)*ny+ys.indexOf(point.y),point=(id:number):DiagramPoint=>({x:xs[Math.floor(id/ny)],y:ys[id%ny]});
 const occupied:{net:string;a:DiagramPoint;b:DiagramPoint;terminal?:boolean}[]=[];
 const nets=diagram.nets.filter(n=>n.ports.length>1&&(!powerSymbols||n.kind==='signal')).sort((a,b)=>{
  const span=(n:DiagramNet)=>{const ps=n.ports.map(id=>ports.get(id)!.point);return Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x))+Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y))};return span(a)-span(b);
 });
 for(const net of nets)for(const id of net.ports){const port=ports.get(id)!;occupied.push({net:net.id,a:port.point,b:escape(port),terminal:true})}
 for(const net of nets){
  const terminals=net.ports.map(id=>ports.get(id)!).sort((a,b)=>a.point.x-b.point.x||a.point.y-b.point.y),tree=new Set<number>([index(escape(terminals[0]))]);
  diagram.routes.push({netId:net.id,points:[terminals[0].point,escape(terminals[0])]});
  for(const terminal of terminals.slice(1)){
   const lead=escape(terminal),start=index(lead);if(start<0||ys.indexOf(lead.y)<0){diagram.unrouted.push(net.id);continue}
   const total=xs.length*ny*3,dist=new Float64Array(total).fill(Infinity),previous=new Int32Array(total).fill(-1),heap=new DiagramHeap();dist[start*3]=0;heap.push(start*3,0);let goal=-1,visits=0;
   while(heap.items.length&&visits++<65000){
    const current=heap.pop();if(current.cost>dist[current.id]+.001)continue;const direction=current.id%3,cell=Math.floor(current.id/3),ix=Math.floor(cell/ny),iy=cell%ny,a=point(cell);
    if(tree.has(cell)){goal=current.id;break}
    for(const [dx,dy,dir] of [[-1,0,1],[1,0,1],[0,-1,2],[0,1,2]]){
     const x=ix+dx,y=iy+dy;if(x<0||x>=xs.length||y<0||y>=ys.length)continue;const next=x*ny+y,b=point(next);
     if(boxes.some(box=>dir===1?a.y>box.top&&a.y<box.bottom&&Math.max(a.x,b.x)>box.left&&Math.min(a.x,b.x)<box.right:a.x>box.left&&a.x<box.right&&Math.max(a.y,b.y)>box.top&&Math.min(a.y,b.y)<box.bottom))continue;
     let penalty=0,blocked=false;
     for(const segment of occupied){if(segment.net===net.id)continue;const horizontal=segment.a.y===segment.b.y;
      if((dir===1)===horizontal){const gap=dir===1?Math.abs(a.y-segment.a.y):Math.abs(a.x-segment.a.x),overlap=dir===1?Math.min(Math.max(a.x,b.x),Math.max(segment.a.x,segment.b.x))-Math.max(Math.min(a.x,b.x),Math.min(segment.a.x,segment.b.x)):Math.min(Math.max(a.y,b.y),Math.max(segment.a.y,segment.b.y))-Math.max(Math.min(a.y,b.y),Math.min(segment.a.y,segment.b.y));if(gap<2&&overlap>0){blocked=true;break}if(gap<10&&overlap>0)penalty+=80;
      }else{const cross=dir===1?segment.a.x>=Math.min(a.x,b.x)&&segment.a.x<=Math.max(a.x,b.x)&&a.y>=Math.min(segment.a.y,segment.b.y)&&a.y<=Math.max(segment.a.y,segment.b.y):a.x>=Math.min(segment.a.x,segment.b.x)&&a.x<=Math.max(segment.a.x,segment.b.x)&&segment.a.y>=Math.min(a.y,b.y)&&segment.a.y<=Math.max(a.y,b.y);if(cross){if(segment.terminal){blocked=true;break}penalty+=46}}
     }
     if(blocked)continue;
     const cost=current.cost+distance(a,b)+(direction&&direction!==dir?20:0)+penalty,id=next*3+dir;
     if(cost<dist[id]){dist[id]=cost;previous[id]=current.id;heap.push(id,cost)}
    }
   }
   if(goal<0){diagram.unrouted.push(net.id);continue}
   const cells:number[]=[];for(let id=goal;id>=0;id=previous[id])cells.push(Math.floor(id/3));cells.reverse();
   if(tree.size>1)diagram.junctions.push({netId:net.id,point:point(Math.floor(goal/3))});
   for(const cell of cells)tree.add(cell);
   const points=compact([terminal.point,...cells.map(point)]);diagram.routes.push({netId:net.id,points});for(let i=1;i<points.length;i++)occupied.push({net:net.id,a:points[i-1],b:points[i]});
  }
 }
 const seen=new Set<string>();
 for(let i=0;i<occupied.length;i++)for(let j=0;j<i;j++){
  const a=occupied[i],b=occupied[j];if(a.net===b.net||(a.a.y===a.b.y)===(b.a.y===b.b.y))continue;
  const horizontal=a.a.y===a.b.y,h=horizontal?a:b,v=horizontal?b:a,p={x:v.a.x,y:h.a.y};
  if(p.x<=Math.min(h.a.x,h.b.x)||p.x>=Math.max(h.a.x,h.b.x)||p.y<=Math.min(v.a.y,v.b.y)||p.y>=Math.max(v.a.y,v.b.y))continue;
  const key=pointKey(p);if(seen.has(key))continue;seen.add(key);diagram.crossings.push({point:p,over:a.net,under:b.net,horizontal});
 }
 diagram.unrouted=[...new Set(diagram.unrouted)];
}
