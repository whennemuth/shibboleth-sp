# -----------------------------------------------------------
#                      STAGE 1
# -----------------------------------------------------------
FROM node:slim AS baseline

ENV NODE_ENV development
USER root

COPY ./src ./sp/src/
COPY ./package.json ./sp/
COPY ./tsconfig.json ./sp/

# Build the sp request event handler package
WORKDIR /sp
RUN npm install -g typescript
RUN npm install --save-dev

# Transpile typescript code and create source maps
# RUN node_modules/typescript/bin/tsc -p tsconfig.json
RUN npm run build:tsc

# Specify the 3rd arg in the command option in the compose yml or docker run command
ENTRYPOINT [ "node", "--inspect=0.0.0.0" ]