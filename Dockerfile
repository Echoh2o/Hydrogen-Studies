# Simple deployment configuration for Replit
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start the application directly with tsx
CMD ["npx", "tsx", "server/index.ts"]