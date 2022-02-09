FROM node:14-alpine

# install jq - required for the replacement of env variables
RUN apk add --no-cache jq

# create the workdir
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install global dependencies
RUN npm install -g bunyan

COPY package.json package-lock.json ./

# install the dependencies
RUN npm install

COPY . .

RUN ln -s /usr/src/app/bin/index.js /usr/bin/ckan-proxy \
 && ln -s /usr/src/app/scripts/docker/docker-entrypoint.sh /docker-entrypoint.sh \
 && ln -s /usr/src/app/settings-dev.json /etc/ckan-proxy.json

ENV SEARCH_ENDPOINT=http://piveau-hub-search.fokus.svc.cluster.local:8080/search\
    WHITELIST_UPDATE_INTERVAL_MINUTES=60 \
    LOGGING_LEVEL=info \
    CONFIG_FILE=/etc/ckan-proxy.json

# expose the folder of the whitelist
VOLUME /var/lib/ckan-proxy

EXPOSE 9090

ENTRYPOINT [ "/docker-entrypoint.sh" ]
CMD [ "ckan-proxy", "/etc/ckan-proxy.json" ]
