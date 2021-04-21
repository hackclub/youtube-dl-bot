FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json yarn.lock ./

# Run yarn without generating a yarn.lock file
RUN yarn --pure-lockfile

# Bundle app source
COPY . .

# Use the port used by our server.js configuration
EXPOSE 7000
ENV PORT 7000
CMD [ "yarn", "start" ]