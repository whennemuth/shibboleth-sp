# Running locally

### Overview: Run two containers:

1. **Container A**: A lambda@edge simulator.
   The nodejs package that backs the lambda@edge origin request function will run in a container and be exposed to ones browser over port 5000.
2. **Container B**: The targeted origin or "app".
   This will be something like wordpress or anything else that listens for https requests.
   Its port is not published and will only be accessible by container A over the internal docker network bridge *(as an origin typically would only be accessible by the lambda@edge function)*.

With these two containers running, the cloud-based scenario is simulated to some degree in that all requests bound for container B must go through container A first to be inspected for tokens and proof of authenticated status with the shibboleth IDP.

Container A is essentially a nodejs/express app acting as a reverse proxy with some "adapter" functionality applied.
The "adapter" functionality allows container A to simulate cloudfront@edge, by transforming http requests from express into objects that conform to the [lambda@edge event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html#lambda-event-structure-request) before passing them in to the main lambda@edge nodejs artifact. Similarly, all response objects returned are converted back into regular http responses on their way back to the client.

### Steps to run:

1. **Install:**
   From the root directory, install dependencies for the main module and all nested modules:

   ```
   npm run install-all
   ```

2. **Set .env file**:

   - <u>Secrets lookup</u>:
      One of the tasks performed by the lambda@edge origin request function is to make a call to secrets manager to acquire secrets for shibboleth and JWT certs & keys. For this approach, set the `.env` file like this:
   
   ```
      AWS_PROFILE="bu"
      DOCKER_REGISTRY="037860335094.dkr.ecr.us-east-2.amazonaws.com"
      EXPRESS_PORT=5000
      ENTITY_ID="https://*.kualitest.research.bu.edu/shibboleth"
      IDP_CERT="<ds:X509Certificate> value from https://shib-test.bu.edu/idp/shibboleth goes here"
      ENTRY_POINT="https://shib-test.bu.edu/idp/profile/SAML2/Redirect/SSO"
      LOGOUT_URL="https://shib-test.bu.edu/idp/logout.jsp"
   ```
   
      In this example, we are borrowing configuration values from the kuali application.
      *NOTE: The `AWS_PROFILE` environment variable should reflect the appropriate named credentials in your `~/.aws/credentials` file. Or you can swap  `AWS_PROFILE` out entirely for `AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY`, & `AWS_SESSION_TOKEN` values.*
   
   - OR...
   
   - <u>Manual:</u>
      To access the certs and keys directly from the environment, set the `.env` file like this:
   
      ```
      EXPRESS_PORT=5000
      DOCKER_REGISTRY="037860335094.dkr.ecr.us-east-2.amazonaws.com"
      ENTITY_ID="https://*.kualitest.research.bu.edu/shibboleth"
      IDP_CERT="<ds:X509Certificate> value from https://shib-test.bu.edu/idp/shibboleth goes here"
      ENTRY_POINT="https://shib-test.bu.edu/idp/profile/SAML2/Redirect/SSO"
      LOGOUT_URL="https://shib-test.bu.edu/idp/logout.jsp"
      SAML_CERT="-----BEGIN CERTIFICATE-----
      MIIEGzCCAoOgAwIBAgIJAPhkIj1CZ3z3MA0GCSqGSIb3DQEBCwUAMCcxJTAjBgNV
      BAMTHGlwLTEwLTU3LTIzNy0yMS5lYzIuaW50ZXJuYWwwHhcNMTYwODA4MDQyNzE4
      ...
      -----END CERTIFICATE-----"
      SAML_PK="-----BEGIN PRIVATE KEY-----
      MIIG/gIBADANBgkqhkiG9w0BAQEFAASCBugwggbkAgEAAoIBgQDLQEgmPeVMBas1
      50ujt9qPzpch1W9cae5KCmr2BBzq+koNSZNzLTVUN4bl4ZeZrtCeJ7WBJN6Uztva
      ...
      -----END PRIVATE KEY-----"
      ```

      Replace `SAML_CERT` and `SAML_PK` with the full values.
      *NOTE: The JWT keys do not need to be set here as they are arbitrary for running locally and will be auto-generated.*

3. **Run as launch configuration:** This is one method that facilitates step debugging with a vscode launch configuration *(no docker)*. 
   It can be found In `.vscode/launch.json`:

   ```
   {
     "type": "node",
     "request": "launch",
     "name": "sp-express-app",
     "skipFiles": [
       "<node_internals>/**"
     ],
     "args": [
       "${workspaceFolder}/docker-entrypoint.js",
     ], 
     "envFile": "${workspaceFolder}/.env"   
   }
   ```
   
   Bundle the main lambda@edge nodejs package:
   
   ```
   npm run bundle
   ```
   
   Then run the launch configuration and navigate to https://localhost:5000/some/path?qs=some_value
   
4. OR...

5. **Run as docker-compose service:**
   The following command performs bundling, pruning, forced building & running in one command:

   ```
   npm run up
   ```

6. **Publish:**
   The .env file used by docker compose takes a DOCKER_REGISTRY variable in anticipation of publishing the docker image to a registry.
   Change this as appropriate to reflect your registry *(like [dockerhub](https://hub.docker.com/) or another [ECR](https://docs.aws.amazon.com/AmazonECR/latest/public/getting-started-cli.html))*.
   Publish to ECR:

   1. Retrieve an authentication token and authenticate your Docker client to your registry. Use the AWS CLI:

      ```
      aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 037860335094.dkr.ecr.us-east-2.amazonaws.com
      ```

   2. Run the following command to push this image to your newly created AWS repository:

      ```
      docker push 037860335094.dkr.ecr.us-east-2.amazonaws.com/bu-shibboleth-sp:latest
      ```

      

