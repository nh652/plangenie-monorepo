#!/bin/bash

# This script will build the frontend and then start the backend server.

echo "--- Installing backend dependencies ---"
npm install

echo "--- Installing frontend dependencies and building frontend ---"
cd plangenie-frontend
npm install
npm run build
cd ..

echo "--- Starting backend server ---"
node index.js
