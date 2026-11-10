# Deploying Circuit Studio 3D

Circuit Studio is a static, browser-only application. Build it with `npm ci` and `npm run build`, then publish the generated `dist/` directory to any static web host (for example GitHub Pages, Netlify, Cloudflare Pages, or an Nginx web root). The host needs to serve `index.html` as the fallback for the app route. No application server, account system, database, or cloud project storage is required.

## GitHub Pages

The included workflow at `.github/workflows/deploy.yml` builds and deploys the `main` branch on every push (and supports manual runs). In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source. Push the project to a GitHub repository with a `main` branch; Vite reads the repository name from Actions and sets the correct project-site path automatically. The workflow publishes the built `dist/` folder.

For a subpath deployment, set Vite's `base` option to the public path before building. The default build targets a domain root. Keep HTTPS enabled so browser file and graphics APIs work consistently.

Every page load starts a new blank simulation. Visitors can add components, use **Save** to download a `.c3dproj` file or **Package** to download a portable `.c3dzip` including model assets, and use **Open** to choose a previously saved file from their device. The application does not upload simulation files. Custom component library items are kept in that browser's local IndexedDB; users should export those components or include them in project packages when they need to move them to another browser/device.

## Local production preview

```bash
npm ci
npm run build
npm run preview
```

Generated captures and test artifacts are excluded from the GitHub deployment repository; the app source, component data, and runtime model assets are included.
