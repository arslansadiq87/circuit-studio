import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {startProjectAutosave} from './projectPersistence';
import './style.css';
class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}>{state={error:null as Error|null};static getDerivedStateFromError(error:Error){return {error}}componentDidCatch(error:Error){console.error('Circuit Studio render error',error)}render(){if(this.state.error)return <main style={{padding:32,color:'#eee',fontFamily:'sans-serif'}}><h1>Circuit Studio could not render this project</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>Reload editor</button></main>;return this.props.children}}

// Every visit starts with a fresh in-memory workspace. Project files are saved
// and reopened explicitly on the visitor's own device.
startProjectAutosave();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>);
