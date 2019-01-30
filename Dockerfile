FROM node:8

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

# install jq - required for the replacement of env variables
RUN apt-get update && \
    apt-get install --no-install-recommends -y jq && \
    apt-get -y autoremove --purge && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


COPY ./docker/startup.sh ./startup.sh

EXPOSE 9090

CMD ["./startup.sh"]