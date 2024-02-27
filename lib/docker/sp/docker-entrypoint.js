const { handler, getJwtTools, getKeyLib } = require('./sp');
const { startServer } = require('./entrypoint');

startServer({
  handler, getJwtTools, getKeyLib
});