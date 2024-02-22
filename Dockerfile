
# -----------------------------------------------------------
#                      STAGE 1
# -----------------------------------------------------------
FROM node:slim AS baseline

ENV NODE_ENV development
USER root
WORKDIR /shibboleth

COPY lib ./lib/
# Creating a dummy context.json file - will keep default imports and destructuring working.
RUN mkdir ./context && echo '{ "SHIBBOLETH": { "secret": {} } }' > context/context.json
COPY context/IContext.ts ./context/

WORKDIR /shibboleth/lib/lambda

COPY docker-entrypoint.js ./

RUN npm install --save-dev

RUN npm install esbuild -g

RUN \
  esbuild ./FunctionSpOrigin.ts --bundle --platform=node --outfile=sp.js && \
  esbuild ./docker-entrypoint.js --bundle --platform=node --outfile=entrypoint.js
 

# -----------------------------------------------------------
#                      STAGE 2
# -----------------------------------------------------------
FROM node:slim

ENV NODE_ENV development
USER root
WORKDIR /shibboleth

RUN apt update -y && apt upgrade -y && apt install -y curl;

COPY --from=baseline /shibboleth/lib/lambda/sp.js /shibboleth/sp.js
COPY --from=baseline /shibboleth/lib/lambda/entrypoint.js /shibboleth/entrypoint.js

CMD [ "node", "entrypoint.js" ]
