To successfully deploy your Sangam Sahayak application to Google Cloud Run, you need two specific files in your project root: a Dockerfile and an nginx.conf.
Cloud Run requires your container to listen on port 8080 by default, and since this is a Single Page Application (SPA), Nginx needs to be configured to handle routing correctly (so that refreshing the page doesn't cause a 404).
Specification for Deployment Files
Dockerfile:
Stage 1 (Build): Uses node:20-alpine to install dependencies and run npm run build. This generates the static files in the dist folder.
Stage 2 (Production): Uses nginx:stable-alpine to serve those static files. It copies a custom nginx.conf and the dist folder contents. It exposes port 8080.
nginx.conf:
Configures the server to listen on 8080.
Includes a try_files directive to ensure that all requests are routed to index.html, allowing React to handle navigation.
