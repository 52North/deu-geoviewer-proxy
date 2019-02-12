FROM node:alpine

# install jq - required for the replacement of env variables
RUN apk update && \
    apk add jq && \
    rm -rf /var/cache/apk/*

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

COPY ./docker/startup.sh ./startup.sh

# some env vars
ENV EDP_DATA_API_URL https://www.europeandataportal.eu/data
ENV WHITELIST_UPDATE_INTERVAL_MINUTES 60
ENV WHITELIST_STORAGE_DIR /tmp/ckan-whitelist.json
ENV LOGGING_LEVEL info

EXPOSE 9090

CMD ["./startup.sh"]
