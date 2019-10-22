FROM node:alpine

# install jq - required for the replacement of env variables
RUN apk add --no-cache jq

WORKDIR /usr/src/app

RUN npm install -g bunyan

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN ln -s /usr/src/app/bin/index.js /usr/bin/ckan-proxy \
 && ln -s /usr/src/app/scripts/docker/docker-entrypoint.sh /docker-entrypoint.sh \
 && ln -s /usr/src/app/settings-dev.json /etc/ckan-proxy.json

ENV EDP_DATA_API_URL=https://www.europeandataportal.eu/data \
    WHITELIST_UPDATE_INTERVAL_MINUTES=60 \
    LOGGING_LEVEL=info \
    CONFIG_FILE=/etc/ckan-proxy.json

# expose the folder of the whitelist
VOLUME /var/lib/ckan-proxy

EXPOSE 9090

ENTRYPOINT [ "/docker-entrypoint.sh" ]
CMD [ "ckan-proxy", "${CONFIG_FILE}" ]
