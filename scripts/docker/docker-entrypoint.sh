#!/bin/sh

cat ${CONFIG_FILE} |\
    jq '.whitelist.ckan.url = "'${SEARCH_ENDPOINT}'"' |\
    jq '.whitelist.ckan.updateInterval = '${WHITELIST_UPDATE_INTERVAL_MINUTES} |\
    jq '.logging.level = "'${LOGGING_LEVEL}'"' >> ${CONFIG_FILE}.tmp \
  && mv ${CONFIG_FILE}.tmp ${CONFIG_FILE}

exec "$@"
