import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {restoreLocalProject,startProjectAutosave} from './projectPersistence';
import {useEditor} from './store';
import './style.css';
class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}>{state={error:null as Error|null};static getDerivedStateFromError(error:Error){return {error}}componentDidCatch(error:Error){console.error('Circuit Studio render error',error)}render(){if(this.state.error)return <main style={{padding:32,color:'#eee',fontFamily:'sans-serif'}}><h1>Circuit Studio could not render this project</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>Reload editor</button></main>;return this.props.children}}

// Restore before mounting or starting autosave so an empty workspace cannot
// overwrite the previous session while IndexedDB is still opening.
async function bootstrap(){
 const project=await restoreLocalProject();
 if(project)useEditor.setState({project,selectedId:null,dirty:false,undoStack:[],redoStack:[]});
 startProjectAutosave();
 ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>);
}
void bootstrap();
