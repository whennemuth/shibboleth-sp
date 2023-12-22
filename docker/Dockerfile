FROM node:slim

ENV NODE_ENV development

USER root

WORKDIR /shibboleth

COPY sp.js index.js package.json package-lock.json ./

RUN npm install

CMD [ "node", "index.js" ]

EXPOSE 5000