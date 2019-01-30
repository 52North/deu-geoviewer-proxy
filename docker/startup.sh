#!/bin/bash
## startup wrapper script

PROJECT_DIR=/usr/src/app
CONFIG_FILE=$(find ${PROJECT_DIR} -type f -name 'settings-edp.json')

cat ${CONFIG_FILE} |\
    jq '.whitelist.ckan.url = "'${EDP_DATA_API_URL}'"' |\
    jq '.whitelist.ckan.updateInterval = '${WHITELIST_UPDATE_INTERVAL_MINUTES} |\
    jq '.logging.level = "'${LOGGING_LEVEL}'"' >> ${CONFIG_FILE}.tmp && mv ${CONFIG_FILE}.tmp ${CONFIG_FILE}

node bin/index.js settings-edp.json