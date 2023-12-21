FROM node:slim

ENV NODE_ENV development

WORKDIR /shibboleth

COPY sp.js index.js package.json package-lock.json ./

RUN npm install

RUN \
  apk add openssl; \
  openssl req -newkey rsa:2048 \
    -x509 \
    -sha256 \
    -days 3650 \
    -nodes \
    -out cert.pem \
    -keyout keytmp.pem \
    -subj "/C=US/ST=MA/L=Boston/O=BU/OU=IST/CN=localhost"; \
  openssl rsa -in keytmp.pem -out key.pem;


CMD [ "node", "index.js" ]

EXPOSE 5000