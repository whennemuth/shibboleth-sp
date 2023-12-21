
build() {
  # Bundle the totality of saml SP code (custom & dependencies) into a single js artifact
  esbuild ../lib/lambda/FunctionSpOrigin.ts --bundle --platform=node --outfile=sp.js

  # Make the handler function exportable
  sed -i 's/var handler = async (event) => {/exports.handler = async (event) => {/' sp.js
}

# build

runlocal() {
  # docker build . -t 
  export MSYS_NO_PATHCONV=1
  # docker run -ti --entrypoint /bin/sh nginx:alpine-slim -c "tail -f /dev/null"
  docker run --rm -ti --name mytest node:alpine /bin/sh
}

runlocal