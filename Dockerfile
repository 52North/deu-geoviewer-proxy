FROM node:latest

# create the workdir
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install global dependencies
RUN npm install -g bunyan

# copy the package.json
COPY package.json package-lock.json /usr/src/app/

# install the dependencies
RUN npm install

# copy the rest of the app
COPY . /usr/src/app

# copy the settings file
COPY settings-dev.json /etc/ckan-proxy.json

# link the binary
RUN ln -s /usr/src/app/bin/index.js /usr/local/bin/ckan-proxy

# expose the folder of the whitelist
VOLUME /tmp

# expose the port
EXPOSE 9090

# the command
CMD  [ "ckan-proxy", "/etc/ckan-proxy.json" ]