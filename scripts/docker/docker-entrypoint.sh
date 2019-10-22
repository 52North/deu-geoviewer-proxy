#!/bin/sh

cat ${CONFIG_FILE} |\
    jq '.whitelist.ckan.url = "'${EDP_DATA_API_URL}'"' |\
    jq '.whitelist.ckan.updateInterval = '${WHITELIST_UPDATE_INTERVAL_MINUTES} |\
    jq '.logging.level = "'${LOGGING_LEVEL}'"' >> ${CONFIG_FILE}.tmp \
  && mv ${CONFIG_FILE}.tmp ${CONFIG_FILE}

exec "$@"
