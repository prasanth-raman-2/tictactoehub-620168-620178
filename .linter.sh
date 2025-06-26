#!/bin/bash
cd /tmp/kavia/workspace/code-generation/tictactoehub-620168-620178/tic_tac_toe_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

