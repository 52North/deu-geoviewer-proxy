#!/bin/sh

cat ${CONFIG_FILE} |\
    jq '.whitelist.sparql.url = "'${SPARQL_ENDPOINT}'"' |\
    jq '.whitelist.sparql.updateInterval = '${WHITELIST_UPDATE_INTERVAL_MINUTES} |\
    jq '.logging.level = "'${LOGGING_LEVEL}'"' >> ${CONFIG_FILE}.tmp \
  && mv ${CONFIG_FILE}.tmp ${CONFIG_FILE}

exec "$@"
