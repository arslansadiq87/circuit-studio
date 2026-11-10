import type {Component,Wire} from './model';
import {planAutoWires} from './autoRouting';

self.onmessage=(event:MessageEvent<{wires:Wire[];components:Component[]}>)=>{
 try{self.postMessage({wires:planAutoWires(event.data.wires,event.data.components)})}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'Routing failed'})}
};
