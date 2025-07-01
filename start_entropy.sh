#!/bin/bash

N=${1:-3}
BASE_PORT=5000

for ((i=0; i<N; i++)); do
  PORT=$((BASE_PORT + i))
  PEERS=""
  for ((j=0; j<N; j++)); do
    if [ $i -ne $j ]; then
      PEERS="$PEERS localhost:$((BASE_PORT + j))"
    fi
  done
  kgx -- bash -c "echo 'Nó $i na porta $PORT'; node gossip_anti_entropy.js $PORT $PEERS; exec bash" &
done