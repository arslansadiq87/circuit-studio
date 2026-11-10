import {create} from 'zustand';
export const useWireRouteEditor=create<{id:string|null;set:(id:string|null)=>void}>(set=>({id:null,set:id=>set({id})}));
