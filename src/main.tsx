import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {startProjectAutosave} from './projectPersistence';
import './style.css';

// Every visit starts with a fresh in-memory workspace. Project files are saved
// and reopened explicitly on the visitor's own device.
startProjectAutosave();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
